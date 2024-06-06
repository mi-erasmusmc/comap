/**
 * ***************************************************************************** Copyright 2017
 * Erasmus Medical Center, Department of Medical Informatics.
 *
 * <p>This program shall be referenced as “Codemapper”.
 *
 * <p>This program is free software: you can redistribute it and/or modify it under the terms of the
 * GNU Affero General Public License as published by the Free Software Foundation, either version 3
 * of the License, or (at your option) any later version.
 *
 * <p>This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
 * without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * <p>You should have received a copy of the GNU Affero General Public License along with this
 * program. If not, see <http://www.gnu.org/licenses/>.
 * ****************************************************************************
 */
package org.biosemantics.codemapper.persistency;

import com.fasterxml.jackson.core.JsonProcessingException;
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
      while (result.next()) results.add(result.getString(1));
      return results;
    } catch (SQLException e) {
      throw CodeMapperException.server("Cannot execute query to get projects", e);
    }
  }

  private List<String> parameterizedStringListQuery(String query, String... arguments)
      throws SQLException {
    try (Connection connection = connectionPool.getConnection();
        PreparedStatement statement = connection.prepareStatement(query)) {
      for (int i = 0; i < arguments.length; i++) statement.setString(i + 1, arguments[i]);
      ResultSet result = statement.executeQuery();
      List<String> results = new LinkedList<>();
      while (result.next()) results.add(result.getString(1));
      return results;
    }
  }

  private String parameterizedStringQuery(String query, String... arguments) throws SQLException {
    try (Connection connection = connectionPool.getConnection();
        PreparedStatement statement = connection.prepareStatement(query)) {
      for (int i = 0; i < arguments.length; i++) statement.setString(i + 1, arguments[i]);
      ResultSet result = statement.executeQuery();
      if (result.next()) return result.getString(1);
      else return null;
    }
  }

  public Map<String, Set<ProjectPermission>> getProjectPermissions(String username)
      throws CodeMapperException {
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

  public Map<String, Set<ProjectPermission>> getUsersOfProject(String project)
      throws CodeMapperException {
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
        if (!users.containsKey(username)) users.put(username, new HashSet<ProjectPermission>());
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

  public String getCaseDefinition(String project, String caseDefinitionName)
      throws CodeMapperException {
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

  public MappingRevision getLatestRevision(String projectName, String caseDefinitionName)
      throws CodeMapperException {
    String query =
        "SELECT r.version, r.mapping, r.timestamp, r.summary, u.username as user "
            + "FROM case_definition_revisions r "
            + "INNER JOIN projects_case_definitions pcd "
            + "ON r.case_definition_id = pcd.case_definition_id "
            + "INNER JOIN users u "
            + "ON u.id = r.user_id "
            + "WHERE pcd.project_name = ? "
            + "AND pcd.case_definition_name = ? "
            + "ORDER BY r.timestamp DESC "
            + "LIMIT 1";

    try (Connection connection = connectionPool.getConnection();
        PreparedStatement statement = connection.prepareStatement(query)) {
      statement.setString(1, projectName);
      statement.setString(2, caseDefinitionName);
      ResultSet result = statement.executeQuery();
      if (result.next()) {
        int version = result.getInt("version");
        String mapping = result.getString("mapping");
        String summary = result.getString("summary");
        String timestamp = result.getString("timestamp");
        String user = result.getString("user");
        return new MappingRevision(version, user, timestamp, summary, mapping);
      } else {
        return null;
      }
    } catch (SQLException e) {
      throw CodeMapperException.server("Cannot execute query to get latest revision", e);
    }
  }

  public List<MappingRevision> getRevisions(String projectName, String caseDefinitionName)
      throws CodeMapperException {
    String query =
        "SELECT r.version, u.username AS user, r.timestamp, r.summary "
            + "FROM case_definition_revisions r "
            + "INNER JOIN projects_case_definitions pcd "
            + "ON r.case_definition_id = pcd.case_definition_id "
            + "INNER JOIN users u "
            + "ON u.id = r.user_id "
            + "WHERE pcd.project_name = ? "
            + "AND pcd.case_definition_name = ? "
            + "ORDER BY r.timestamp DESC";

    try (Connection connection = connectionPool.getConnection();
        PreparedStatement statement = connection.prepareStatement(query)) {
      statement.setString(1, projectName);
      statement.setString(2, caseDefinitionName);
      ResultSet result = statement.executeQuery();
      List<MappingRevision> res = new LinkedList<>();
      while (result.next()) {
        int version = result.getInt("version");
        String user = result.getString("user");
        String timestamp = result.getString("timestamp");
        String summary = result.getString("summary");
        res.add(new MappingRevision(version, user, timestamp, summary, null));
      }
      return res;
    } catch (SQLException e) {
      throw CodeMapperException.server("Cannot execute query to get latest revision", e);
    }
  }

  public int saveRevision(
      String projectName,
      String caseDefinitionName,
      String username,
      String summary,
      String mappingJson)
      throws CodeMapperException {
    int caseDefId = setCaseDefinition(projectName, caseDefinitionName, null);
    String query =
        ""
            + "INSERT INTO case_definition_revisions "
            + "(case_definition_id, user_id, mapping, summary) "
            + "SELECT ?, u.id, ?::jsonb, ? "
            + "FROM users u "
            + "WHERE u.username = ? "
            + "RETURNING id";
    try (Connection connection = connectionPool.getConnection();
        PreparedStatement statement = connection.prepareStatement(query)) {
      int ix = 1;
      statement.setInt(ix++, caseDefId);
      statement.setString(ix++, mappingJson);
      statement.setString(ix++, summary);
      statement.setString(ix++, username);
      ResultSet result = statement.executeQuery();
      if (result.next()) {
        return result.getInt("id");
      } else {
        throw CodeMapperException.server("Save revision did not return an id");
      }
    } catch (SQLException e) {
      throw CodeMapperException.server("Cannot execute query to save revision", e);
    }
  }

  public int setCaseDefinition(String projectName, String caseDefinitionName, String stateJson)
      throws CodeMapperException {
    if (stateJson != null) {
      try {
        new ClientState().ofJson(stateJson);
      } catch (JsonProcessingException e) {
        throw CodeMapperException.user("Invalid state", e);
      }
    }
    String query =
        ""
            + "WITH "
            + "arg(projectName, caseDefinitionName, state) AS ( "
            + "  VALUES (?, ?, ?) "
            + "), "
            + "p AS ( "
            + "  SELECT id FROM projects, arg WHERE name = arg.projectName"
            + "), "
            + "ins AS ( "
            // insert new case def with new state or 'null', or update state with non-null new state
            + "  INSERT INTO case_definitions (project_id, name, state) "
            + "  SELECT p.id, arg.caseDefinitionName, arg.state "
            + "  FROM p, arg "
            + "  ON CONFLICT (project_id, name) "
            + (stateJson != null ? "DO UPDATE SET state = arg.state " : "DO NOTHING ")
            + "  RETURNING id "
            + "), "
            + "get AS ( " // get casedef
            + "  SELECT cd.id"
            + "  FROM case_definitions AS cd, p, arg "
            + "  WHERE cd.project_id = p.id "
            + "  AND cd.name = arg.caseDefinitionName"
            + ") "
            + "SELECT id FROM ins UNION ALL SELECT id FROM get";
    try (Connection connection = connectionPool.getConnection();
        PreparedStatement statement = connection.prepareStatement(query)) {
      int ix = 1;
      statement.setString(ix++, projectName);
      statement.setString(ix++, caseDefinitionName);
      statement.setString(ix++, stateJson != null ? stateJson : "null");
      ResultSet res = statement.executeQuery();
      if (res.next()) {
        return res.getInt(1);
      } else {
        throw CodeMapperException.server("No id from setting case definition");
      }
    } catch (SQLException e) {
      throw CodeMapperException.server("Cannot execute query to set case definition", e);
    }
  }

  public List<Comment> getComments(String project, String caseDefinition)
      throws CodeMapperException {
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

  public void createComment(
      String project, String caseDefinition, User user, String cui, String content)
      throws CodeMapperException {
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

  public int ensureUser(String username) throws CodeMapperException {
    String query =
        ""
            + "WITH sel AS ( "
            + "  SELECT u.id "
            + "  FROM users AS u "
            + "  WHERE u.username = ? "
            + "), ins AS ( "
            + "  INSERT INTO users (username, password, email, anonymous) "
            + "  VALUES (?, '', '', true) "
            + "  ON CONFLICT DO NOTHING "
            + "  RETURNING id "
            + ") "
            + "SELECT id FROM sel "
            + "UNION ALL "
            + "SELECT id FROM ins";
    try (Connection connection = connectionPool.getConnection();
        PreparedStatement statement = connection.prepareStatement(query)) {
      statement.setString(1, username);
      statement.setString(2, username);
      ResultSet res = statement.executeQuery();
      if (!res.next()) {
        throw CodeMapperException.server("Missing ID to ensure user");
      }
      return res.getInt(1);
    } catch (SQLException e) {
      throw CodeMapperException.server("Cannot execute query to ensure user", e);
    }
  }

  public void ensureUsers(Set<String> users) throws CodeMapperException {
    for (String user : users) {
      ensureUser(user);
    }
  }
}
