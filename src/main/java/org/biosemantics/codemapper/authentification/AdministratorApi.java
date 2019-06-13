package org.biosemantics.codemapper.authentification;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.LinkedList;
import java.util.List;

import javax.sql.DataSource;
import javax.ws.rs.NotFoundException;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.biosemantics.codemapper.CodeMapperException;

public class AdministratorApi {

	private static Logger logger = LogManager.getLogger(AuthentificationApi.class);

	private DataSource connectionPool;

	public AdministratorApi(DataSource connectionPool) {
		this.connectionPool = connectionPool;
	}

	public List<String> getUsers() throws CodeMapperException {
		String query = "SELECT username FROM users";
		try (Connection connection = connectionPool.getConnection();
				PreparedStatement statement = connection.prepareStatement(query)) {
			ResultSet result = statement.executeQuery();
			List<String> users = new LinkedList<>();
			while (result.next()) {
				users.add(result.getString(1));
			}
			return users;
		} catch (SQLException e) {
			throw CodeMapperException.server("Cannot execute query to get users", e);
		}
	}

	public void createUser(String username, String password, String email) throws CodeMapperException {
		String query = "INSERT INTO users (username, password, isAdmin, email) VALUES (?, ?, false, ?)";
		try (Connection connection = connectionPool.getConnection();
				PreparedStatement statement = connection.prepareStatement(query)) {
			statement.setString(1, username);
			statement.setString(2, AuthentificationApi.hash(password));
			statement.setString(3, email);
			statement.executeUpdate();
		} catch (SQLException e) {
			throw CodeMapperException.server("Cannot execute query to create user", e);
		}
	}

	public User getUser(String username) throws CodeMapperException {
		String query = "SELECT isAdmin, email FROM users WHERE username = ?";
		try (Connection connection = connectionPool.getConnection();
				PreparedStatement statement = connection.prepareStatement(query)) {
			statement.setString(1, username);
			ResultSet result = statement.executeQuery();
			if (result.next()) {
				boolean isAdmin = result.getBoolean(1);
				String email = result.getString(2);
				return new User(username, null, isAdmin, email);
			}
			throw new NotFoundException();
		} catch (SQLException e) {
			throw CodeMapperException.server("Cannot execute query to get user", e);
		}
	}

	public void updateUser(String username, String password, boolean isAdmin, String email) throws CodeMapperException {
	}

	public List<String> getProjects() throws CodeMapperException {
		return null;
	}

	public List<String> createProject(String project) throws CodeMapperException {
		return null;
	}

	public List<String> getProject(String project) throws CodeMapperException {
		return null;
	}

	public List<String> getProjectUsers(String project) throws CodeMapperException {
		return null;
	}

	public boolean setProjectUsers(String project, List<String> users) throws CodeMapperException {
		return false;
	}
}