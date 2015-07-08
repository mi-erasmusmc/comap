package nl.erasmusmc.mieur.biosemantics.advance.codemapper.authentification;

import java.util.Map;
import java.util.Set;

import javax.xml.bind.annotation.XmlRootElement;

@XmlRootElement
public class User {
	private String username;
	private Map<String, Set<ProjectPermission>> projectPermissions;
	public User() {
		this(null, null);
	}
	public User(String username, Map<String, Set<ProjectPermission>> projectPermissions) {
		this.username = username;
		this.projectPermissions = projectPermissions;
	}
	@Override
	public String toString() {
		return "User(" + username + ")";
	}
	public String getUsername() {
		return username;
	}
	public void setUsername(String username) {
		this.username = username;
	}
	public Map<String, Set<ProjectPermission>> getProjectPermissions() {
		return projectPermissions;
	}
	public void setProjectPermissions(Map<String, Set<ProjectPermission>> projectPermissions) {
		this.projectPermissions = projectPermissions;
	}
}