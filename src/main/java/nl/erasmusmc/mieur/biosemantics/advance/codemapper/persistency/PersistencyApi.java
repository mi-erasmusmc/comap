package nl.erasmusmc.mieur.biosemantics.advance.codemapper.persistency;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.LinkedList;
import java.util.List;
import java.util.Properties;

import nl.erasmusmc.mieur.biosemantics.advance.codemapper.CodeMapperException;

public class PersistencyApi {

	private String uri;
	private Properties connectionProperties;
	private Connection connection;

	public PersistencyApi(String uri, Properties connectionProperties) {
		this.uri = uri;
		this.connectionProperties = connectionProperties;
	}

	private Connection getConnection() throws SQLException {
		if (connection == null || connection.isClosed())
			connection = DriverManager.getConnection(uri, connectionProperties);
		return connection;
	}

	public List<String> getProjects() throws CodeMapperException {
		String query = "SELECT name FROM projects";
		try (PreparedStatement statement = getConnection().prepareStatement(query)) {
			ResultSet result = statement.executeQuery();
			List<String> results = new LinkedList<>();
			while (result.next())
				results.add(result.getString(1));
			return results;
		}  catch (SQLException e) {
			throw CodeMapperException.server("Cannot execute query to get projects", e);
		}
	}

	private List<String> parameterizedStringListQuery(String query, String... arguments) throws SQLException {
		PreparedStatement statement = getConnection().prepareStatement(query);
		for (int i = 0; i < arguments.length; i++)
			statement.setString(i+1, arguments[i]);
		ResultSet result = statement.executeQuery();
		List<String> results = new LinkedList<>();
		while (result.next())
			results.add(result.getString(1));
		return results;
	}

	private String parameterizedStringQuery(String query, String... arguments) throws SQLException {
		PreparedStatement statement = getConnection().prepareStatement(query);
		for (int i = 0; i < arguments.length; i++)
			statement.setString(i+1, arguments[i]);
		ResultSet result = statement.executeQuery();
		if (result.next())
			return result.getString(1);
		else
			return null;
	}

	public List<String> getProjects(String username) throws CodeMapperException {
		String query =
				"SELECT projects.name FROM projects "
						+ "JOIN users_projects ON projects.id = users_projects.project_id "
						+ "JOIN users ON users.id = users_projects.user_id "
						+ "WHERE users.username = ?";
		try {
			return parameterizedStringListQuery(query, username);
		} catch (SQLException e) {
			throw CodeMapperException.server("Cannot execute query to get projects", e);
		}
	}

	public List<String> getUsersOfProject(String project) throws CodeMapperException {
		String query =
				"SELECT u.username FROM users_projects AS up "
				+ "INNER JOIN users AS u ON u.id = up.user_id "
				+ "INNER JOIN projects as p ON p.id = up.project_id "
				+ "WHERE p.name = ?";
		try {
			return parameterizedStringListQuery(query, project);
		} catch (SQLException e) {
			throw CodeMapperException.server("Cannot execute query to get users of project", e);
		}
	}

	public List<String> getCaseDefinitionsNames(String project) throws CodeMapperException {
		String query =
				"SELECT case_definitions.name FROM case_definitions "
						+ "JOIN projects ON projects.id = case_definitions.project_id "
						+ "WHERE projects.name = ?";
		try {
			return parameterizedStringListQuery(query, project);
		} catch (SQLException e) {
			throw CodeMapperException.server("Cannot execute query to get case definition names", e);
		}
	}

	public String getCaseDefinition(String project, String caseDefinitionName) throws CodeMapperException {
		String query =
				"SELECT case_definitions.state FROM case_definitions "
						+ "JOIN projects ON projects.id = case_definitions.project_id "
						+ "WHERE projects.name = ? AND case_definitions.name = ?";
		try {
			return parameterizedStringQuery(query, project, caseDefinitionName);
		} catch (SQLException e) {
			throw CodeMapperException.server("Cannot execute query to get case definition", e);
		}
	}

	public void setCaseDefinition(String project, String caseDefinitionName, String stateJson) throws CodeMapperException {
		String query =
				"INSERT INTO case_definitions (project_id, name, state) "
						+ "SELECT projects.id, ?, ? "
						+ "FROM projects "
						+ "WHERE projects.name = ? "
						+ "ON DUPLICATE KEY UPDATE state = ?";
		try (PreparedStatement statement = getConnection().prepareStatement(query)) {
			statement.setString(1, caseDefinitionName);
			statement.setString(2, stateJson);
			statement.setString(3, project);
			statement.setString(4, stateJson);
			statement.executeUpdate();
		} catch (SQLException e) {
			throw CodeMapperException.server("Cannot execute query to set case definition", e);
		}
	}
}
