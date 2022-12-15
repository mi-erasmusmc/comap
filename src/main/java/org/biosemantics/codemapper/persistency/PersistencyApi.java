/*******************************************************************************
 * Copyright 2017 Erasmus Medical Center, Department of Medical Informatics.
 * 
 * This program shall be referenced as “Codemapper”.
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 * 
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 ******************************************************************************/
package org.biosemantics.codemapper.persistency;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.Calendar;
import java.util.GregorianCalendar;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Set;

import javax.sql.DataSource;
import javax.xml.bind.DatatypeConverter;

import org.biosemantics.codemapper.ClientState;
import org.biosemantics.codemapper.CodeMapperException;
import org.biosemantics.codemapper.Comment;
import org.biosemantics.codemapper.authentification.ProjectPermission;
import org.biosemantics.codemapper.authentification.User;

import com.fasterxml.jackson.core.JsonProcessingException;

public class PersistencyApi {

    private DataSource connectionPool;

	public PersistencyApi(DataSource connectionPool) {
	    this.connectionPool = connectionPool;
	}

	public List<String> getProjects() throws CodeMapperException {
		String query = "SELECT name FROM projects";
        try (Connection connection = connectionPool.getConnection();
             PreparedStatement statement = connection.prepareStatement(query)) {
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
        try (Connection connection = connectionPool.getConnection();
                PreparedStatement statement = connection.prepareStatement(query)) {
            for (int i = 0; i < arguments.length; i++)
                statement.setString(i + 1, arguments[i]);
            ResultSet result = statement.executeQuery();
            List<String> results = new LinkedList<>();
            while (result.next())
                results.add(result.getString(1));
            return results;
        }
    }

	private String parameterizedStringQuery(String query, String... arguments) throws SQLException {
        try (Connection connection = connectionPool.getConnection();
                PreparedStatement statement = connection.prepareStatement(query)) {
            for (int i = 0; i < arguments.length; i++)
                statement.setString(i + 1, arguments[i]);
            ResultSet result = statement.executeQuery();
            if (result.next())
                return result.getString(1);
            else
                return null;
        }
    }


	public Map<String, Set<ProjectPermission>> getProjectPermissions(String username) throws CodeMapperException {
		String query =
				"SELECT projects.name as project, users_projects.role as role "
				+ "FROM users "
				+ "INNER JOIN users_projects ON users_projects.user_id = users.id "
				+ "INNER JOIN projects ON projects.id = users_projects.project_id "
				+ "WHERE users.username = ?";
		try (Connection connection = connectionPool.getConnection();
		     PreparedStatement statement = connection.prepareStatement(query)) {
			statement.setString(1, username);
			ResultSet result = statement.executeQuery();
			Map<String, Set<ProjectPermission>> permissions = new HashMap<>();
			while (result.next()) {
				String project = result.getString("project");
				String role0 = result.getString("role");
				ProjectPermission role = ProjectPermission.fromString(role0);
				if (!permissions.containsKey(project))
					permissions.put(project, new HashSet<ProjectPermission>());
				permissions.get(project).add(role);
			}
			return permissions;
		} catch (SQLException e) {
			throw CodeMapperException.server("Cannot execute query to get projects", e);
		}
	}

	public Map<String, Set<ProjectPermission>> getUsersOfProject(String project) throws CodeMapperException {
		String query =
				"SELECT users.username as username, users_projects.role as role "
				+ "FROM projects "
				+ "INNER JOIN users_projects ON users_projects.project_id = projects.id "
				+ "INNER JOIN users ON users.id = users_projects.user_id "
				+ "WHERE projects.name = ?";
		try (Connection connection = connectionPool.getConnection();
		     PreparedStatement statement = connection.prepareStatement(query)) {
			statement.setString(1, project);
			ResultSet result = statement.executeQuery();
			Map<String, Set<ProjectPermission>> users = new HashMap<>();
			while (result.next()) {
				String username = result.getString("username");
				String role0 = result.getString("role");
				ProjectPermission role = ProjectPermission.fromString(role0);
				if (!users.containsKey(username))
					users.put(username, new HashSet<ProjectPermission>());
				users.get(username).add(role);
			}
			return users;
		} catch (SQLException e) {
			e.printStackTrace();
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
		try {
			new ClientState().ofJson(stateJson);
		} catch (JsonProcessingException e) {
			throw CodeMapperException.user("Invalid state", e);
		}
		String query =
				"INSERT INTO case_definitions (project_id, name, state) "
				+ "SELECT projects.id, ?, ? "
				+ "FROM projects "
				+ "WHERE projects.name = ? "
		        + "ON CONFLICT (project_id, name) DO UPDATE SET state = ?"; // Postgres
//				+ "ON DUPLICATE KEY UPDATE state = ?"; // MySQL
		
        try (Connection connection = connectionPool.getConnection();
             PreparedStatement statement = connection.prepareStatement(query)) {
        	
			statement.setString(1, caseDefinitionName);
			statement.setString(2, stateJson);
			statement.setString(3, project);
			statement.setString(4, stateJson);
			statement.executeUpdate();
		} catch (SQLException e) {
			throw CodeMapperException.server("Cannot execute query to set case definition", e);
		}
	}

	public List<Comment> getComments(String project, String caseDefinition) throws CodeMapperException {
		String query = 
				"SELECT users.username AS author, DATE_TRUNC ('second', timestamp) as timestamp, cui, content, timestamp as full_timestamp "
				+ "FROM comments "
				+ "INNER JOIN users ON comments.author = users.id "
				+ "INNER JOIN case_definitions on comments.case_definition_id = case_definitions.id "
				+ "INNER JOIN projects ON projects.id = case_definitions.project_id "
				+ "WHERE projects.name = ? AND case_definitions.name = ? "
				+ "ORDER BY full_timestamp";
        try (Connection connection = connectionPool.getConnection();
             PreparedStatement statement = connection.prepareStatement(query)) {
			statement.setString(1, project);
			statement.setString(2, caseDefinition);
			ResultSet result = statement.executeQuery();
			List<Comment> comments = new LinkedList<>(); 
			while (result.next()) {
				String author = result.getString("author");
				Timestamp timestamp0 = result.getTimestamp("timestamp");
				String timestamp = timestampToString(timestamp0);
				String cui = result.getString("cui");
				String content = result.getString("content");
				Comment comment = new Comment(cui, author, timestamp, content);
				comments.add(comment);
			}
			return comments;
		} catch (SQLException e) {
			throw CodeMapperException.server("Cannot execute query to get comments", e);
		}
	}

	public static String timestampToString(Timestamp timestamp) {
		Calendar calendar = new GregorianCalendar();
		calendar.setTime(timestamp);
		return DatatypeConverter.printDateTime(calendar);
	}

	public void createComment(String project, String caseDefinition, User user, String cui, String content) throws CodeMapperException {
		String query =
				"INSERT INTO comments (case_definition_id, cui, author, content) "
				+ "SELECT case_definitions.id, ?, users.id, ? "
				+ "FROM users, projects "
				+ "INNER JOIN case_definitions ON projects.id = case_definitions.project_id "
				+ "WHERE projects.name = ? "
				+ "AND case_definitions.name = ? "
				+ "AND users.username = ?";
        try (Connection connection = connectionPool.getConnection();
             PreparedStatement statement = connection.prepareStatement(query)) {
			statement.setString(1, cui);
			statement.setString(2, content);
			statement.setString(3, project);
			statement.setString(4, caseDefinition);
			statement.setString(5, user.getUsername());
			statement.executeUpdate();
		} catch (SQLException e) {
			throw CodeMapperException.server("Cannot execute query to create comments", e);
		}
	}
}
