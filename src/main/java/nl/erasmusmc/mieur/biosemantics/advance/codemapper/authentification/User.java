package nl.erasmusmc.mieur.biosemantics.advance.codemapper.authentification;

import java.util.List;

import javax.xml.bind.annotation.XmlRootElement;

@XmlRootElement
public class User {
	private String username;
	private List<String> projects;
	private boolean isAdmin;
	public User() {
		this(false, null, null);
	}
	public User(boolean isAdmin, String username, List<String> projects) {
		this.isAdmin = isAdmin;
		this.username = username;
		this.projects = projects;
	}
	@Override
	public String toString() {
		return "User(" + username + ")";
	}
	public boolean isAdmin() {
		return isAdmin;
	}
	public void setAdmin(boolean isAdmin) {
		this.isAdmin = isAdmin;
	}
	public String getUsername() {
		return username;
	}
	public void setUsername(String username) {
		this.username = username;
	}
	public List<String> getProjects() {
		return projects;
	}
	public void setProjects(List<String> projects) {
		this.projects = projects;
	}
}