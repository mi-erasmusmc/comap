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

import org.apache.log4j.Logger;

public class DatabasePersistencyApi implements PersistencyApi {

	@SuppressWarnings("unused")
	private static Logger logger = Logger.getLogger("DatabasePersistencyApi");

	private String uri;
	private Properties connectionProperties;
	private Connection connection;

	public DatabasePersistencyApi(String uri, Properties connectionProperties) {
		this.uri = uri;
		this.connectionProperties = connectionProperties;
	}

	private Connection getConnection() throws SQLException {
		if (connection == null || connection.isClosed())
			connection = DriverManager.getConnection(uri, connectionProperties);
		return connection;
	}

	@Override
	public List<String> getProjects() throws CodeMapperException {
		String query = "SELECT name FROM projects";
		try (PreparedStatement statement = getConnection().prepareStatement(query)) {
			ResultSet result = statement.executeQuery();
			List<String> results = new LinkedList<>();
			while (result.next())
				results.add(result.getString(1));
			return results;
		}  catch (SQLException e) {
			throw new CodeMapperException(e);
		}
	}

	private List<String> parameterizedStringListQuery(String query, String... arguments) throws CodeMapperException {
		try (PreparedStatement statement = getConnection().prepareStatement(query)) {
			for (int i = 0; i < arguments.length; i++)
				statement.setString(i+1, arguments[i]);
			ResultSet result = statement.executeQuery();
			List<String> results = new LinkedList<>();
			while (result.next())
				results.add(result.getString(1));
			return results;
		} catch (SQLException e) {
			throw new CodeMapperException(e);
		}
	}

	private String parameterizedStringQuery(String query, String... arguments) throws CodeMapperException {
		try (PreparedStatement statement = getConnection().prepareStatement(query)) {
			for (int i = 0; i < arguments.length; i++)
				statement.setString(i+1, arguments[i]);
			ResultSet result = statement.executeQuery();
			if (result.next())
				return result.getString(1);
			else
				return null;
		} catch (SQLException e) {
			throw new CodeMapperException(e);
		}
	}

	@Override
	public List<String> getProjects(String username) throws CodeMapperException {
		String query =
				"SELECT projects.name FROM projects "
						+ "JOIN users_projects ON projects.id = users_projects.project_id "
						+ "JOIN users ON users.id = users_projects.user_id "
						+ "WHERE users.username = ?";
		return parameterizedStringListQuery(query, username);
	}

	@Override
	public List<String> getCaseDefinitionsNames(String project) throws CodeMapperException {
		String query =
				"SELECT case_definitions.name FROM case_definitions "
						+ "JOIN projects ON projects.id = case_definitions.project_id "
						+ "WHERE projects.name = ?";
		return parameterizedStringListQuery(query, project);
	}

	@Override
	public String getCaseDefinition(String project, String caseDefinitionName) throws CodeMapperException {
		String query =
				"SELECT case_definitions.state FROM case_definitions "
						+ "JOIN projects ON projects.id = case_definitions.project_id "
						+ "WHERE projects.name = ? AND case_definitions.name = ?";
		return parameterizedStringQuery(query, project, caseDefinitionName);
	}

	@Override
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
			System.out.println(statement);
			statement.executeUpdate();
		} catch (SQLException e) {
			throw new CodeMapperException(e);
		}
	}
}
