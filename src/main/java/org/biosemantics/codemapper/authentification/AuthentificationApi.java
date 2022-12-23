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
package org.biosemantics.codemapper.authentification;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Arrays;
import java.util.Collections;
import java.util.Map;
import java.util.Set;

import javax.servlet.http.HttpServletRequest;
import javax.sql.DataSource;
import javax.xml.bind.annotation.XmlRootElement;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.biosemantics.codemapper.CodeMapperException;
import org.biosemantics.codemapper.rest.CodeMapperApplication;
import org.biosemantics.codemapper.rest.UnauthorizedException;

public class AuthentificationApi {

	public static final String SESSION_ATTRIBUTE_USER = "user";

    private DataSource connectionPool;

	private static Logger logger = LogManager.getLogger(AuthentificationApi.class);
	

	public AuthentificationApi(DataSource connectionPool) {
        this.connectionPool = connectionPool;
    }

	private String hash(String string) throws CodeMapperException {
		try {
			MessageDigest sha = MessageDigest.getInstance("SHA-256");
			sha.update(string.getBytes(StandardCharsets.UTF_8));
			byte[] hash = sha.digest();
            StringBuffer hexString = new StringBuffer();
            for (int i = 0; i < hash.length; i++) {
                String hex = Integer.toHexString(0xff & hash[i]);
                if(hex.length() == 1)
                	hexString.append('0');
                hexString.append(hex);
            }
			return hexString.toString();
		} catch (NoSuchAlgorithmException e) {
			throw CodeMapperException.server("Problem while hashing", e);
		}
	}

	@XmlRootElement
	public static class LoginResult {
		private boolean success;
		private User user;
		private String error;
		public LoginResult() {
			this(false, null, null);
		}
		public LoginResult(boolean success, User user, String error) {
			this.success = success;
			this.user = user;
			this.error = error;
		}
		public static LoginResult createSuccess(User user) {
			return new LoginResult(true, user, null);
		}
		public static LoginResult createError(String error) {
			return new LoginResult(false, null, error);
		}
		public boolean isSuccess() {
			return success;
		}
		public void setSuccess(boolean success) {
			this.success = success;
		}
		public User getUser() {
			return user;
		}
		public void setUser(User user) {
			this.user = user;
		}
		public String getError() {
			return error;
		}
		public void setError(String error) {
			this.error = error;
		}
	}

	public LoginResult login(String username, String password, HttpServletRequest request) throws CodeMapperException {

		String query = "SELECT password FROM users WHERE username = ?";
        try (Connection connection = connectionPool.getConnection();
             PreparedStatement statement = connection.prepareStatement(query)) {
			statement.setString(1, username);
			ResultSet result = statement.executeQuery();
			if (result.next()) {
				String passwordHash = result.getString(1);
				if (passwordHash.equals(hash(password))) {
					Map<String, Set<ProjectPermission>> projectPermissions =
					        CodeMapperApplication.getPersistencyApi().getProjectPermissions(username);
					User user = new User(username, projectPermissions);
					request.getSession().setAttribute(SESSION_ATTRIBUTE_USER, user);
					logger.info("Authentificated " + username);
					return LoginResult.createSuccess(user);
				} else
					return LoginResult.createError("Wrong password");
			} else {
				return LoginResult.createError("No such user");
			}
		} catch (SQLException e) {
			throw CodeMapperException.server("Cannot execute query to login", e);
		}
	}

	public User getUser(HttpServletRequest request) {
		return (User) request.getSession().getAttribute(SESSION_ATTRIBUTE_USER);
	}

	public void logout(HttpServletRequest request) {
		request.getSession().invalidate();
	}

	@XmlRootElement
	public static class ChangePasswordResult {
		private boolean ok;
		private String message;
		public ChangePasswordResult() {
		}
		public ChangePasswordResult(boolean ok, String message) {
			this.ok = ok;
			this.message = message;
		}
		public boolean isOk() {
			return ok;
		}
		public void setOk(boolean ok) {
			this.ok = ok;
		}
		public String getMessage() {
			return message;
		}
		public void setMessage(String message) {
			this.message = message;
		}
	}
	
	public ChangePasswordResult changePassword(User user, String password, String newPassword) throws CodeMapperException {
		logger.info("Change password " + user.getUsername());

		String query = "UPDATE users SET password = ? WHERE username = ? AND password = ?";
        try (Connection connection = connectionPool.getConnection();
             PreparedStatement statement = connection.prepareStatement(query)) {
			statement.setString(1, hash(newPassword));
			statement.setString(2, user.getUsername());
			statement.setString(3, hash(password));
			int result = statement.executeUpdate();
			switch (result) {
			case 0:
				return new ChangePasswordResult(false, "Wrong current password");
			case 1:
				return new ChangePasswordResult(true, null);
			default:
				throw CodeMapperException.server(String.format("Too many rows (%d) updated for password change", result)); 
			}
		} catch (SQLException e) {
			throw CodeMapperException.server("Cannot change password", e);
		}
	}

	public static void assertAuthentificated(User user) {
		if (user == null)
			throw new UnauthorizedException();
	}

	/** Test if user has any of the projectPermissions in a project. */
	public static void assertProjectRoles(User user, String project, ProjectPermission... projectPermissions) {
		assertAuthentificated(user);
		Set<ProjectPermission> perms = user.getProjectPermissions().get(project);
		if (perms != null && !Collections.disjoint(perms, Arrays.asList(projectPermissions)))
			return;
		throw new UnauthorizedException();
	}
	
}
