package nl.erasmusmc.mieur.biosemantics.advance.codemapper.web;

import java.io.Serializable;

public class Authentification {
	public static class User implements Serializable {

		private static final long serialVersionUID = 1L;

		public User(String username) {
			this.username = username;
		}

		private String username;

		public String getUsername() {
			return username;
		}

		public void setUsername(String username) {
			this.username = username;
		}
	}

	public static User authentificate(String username, String password) {
		return new User(username);
	}
}
