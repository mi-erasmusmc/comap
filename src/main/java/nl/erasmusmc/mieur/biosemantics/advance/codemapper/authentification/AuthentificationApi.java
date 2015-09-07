package nl.erasmusmc.mieur.biosemantics.advance.codemapper.authentification;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Map;
import java.util.Set;

import javax.servlet.http.HttpServletRequest;
import javax.sql.DataSource;
import javax.xml.bind.annotation.XmlRootElement;

import org.apache.log4j.Level;
import org.apache.log4j.Logger;

import nl.erasmusmc.mieur.biosemantics.advance.codemapper.CodeMapperException;
import nl.erasmusmc.mieur.biosemantics.advance.codemapper.rest.CodeMapperApplication;

public class AuthentificationApi {

	public static final String SESSION_ATTRIBUTE_USER = "user";

    private DataSource connectionPool;

	private static Logger logger = Logger.getLogger("AuthentificationApi");
	static {
		logger.setLevel(Level.ALL);
	}

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
		logger.debug("Authentificate " + username);

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
					return LoginResult.createSuccess(user);
				} else
					return LoginResult.createError("Wrong password");
			} else {
				return LoginResult.createError("No such user");
			}
		} catch (SQLException e) {
			System.err.println("SQL error while authentificating");
			e.printStackTrace();
			throw CodeMapperException.server("Cannot execute query to login", e);
		}
	}

	public User getUser(HttpServletRequest request) {
		return (User) request.getSession().getAttribute(SESSION_ATTRIBUTE_USER);
	}

	public void logout(HttpServletRequest request) {
		request.getSession().invalidate();
	}

}
