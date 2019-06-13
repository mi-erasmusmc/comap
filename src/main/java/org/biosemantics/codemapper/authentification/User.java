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

import java.util.Map;
import java.util.Set;

import javax.xml.bind.annotation.XmlRootElement;

@XmlRootElement
public class User {
	private String username;
	private Map<String, Set<ProjectPermission>> permissions;
	private boolean isAdmin;
	private String email;
	public String getEmail() {
		return email;
	}
	public void setEmail(String email) {
		this.email = email;
	}
	public User() {
		this(null, null, false, null);
	}
	public User(String username, Map<String, Set<ProjectPermission>> permissions, boolean isAdmin, String email) {
		this.username = username;
		this.permissions = permissions;
		this.isAdmin = isAdmin;
		this.email = email;
	}
	@Override
	public String toString() {
		return username;
	}
	public String getUsername() {
		return username;
	}
	public void setUsername(String username) {
		this.username = username;
	}
	public Map<String, Set<ProjectPermission>> getPermissions() {
		return permissions;
	}
	public void setPermissions(Map<String, Set<ProjectPermission>> permissions) {
		this.permissions = permissions;
	}
	public boolean isAdmin() {
		return isAdmin;
	}
	public void setAdmin(boolean isAdmin) {
		this.isAdmin = isAdmin;
	}
}
