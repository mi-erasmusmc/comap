package org.biosemantics.codemapper.rest;

import java.util.List;
import java.util.Map;
import java.util.Set;

import javax.servlet.http.HttpServletRequest;
import javax.ws.rs.FormParam;
import javax.ws.rs.GET;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;

import org.biosemantics.codemapper.CodeMapperException;
import org.biosemantics.codemapper.authentification.AdministratorApi;
import org.biosemantics.codemapper.authentification.ProjectPermission;
import org.biosemantics.codemapper.authentification.User;

@Path("admin")
public class AdministratorResource {
	
	AdministratorApi api = CodeMapperApplication.getAdministratorApi();


	private void assertAdministrator(User user) {
		if (user == null || !user.isAdmin())
			throw new UnauthorizedException();
	}

	@GET
	@Path("user")
	@Produces(MediaType.APPLICATION_JSON)
	public List<String> getUsers(@Context User user) {
		assertAdministrator(user);
		try {
			return api.getUsers();
		} catch (CodeMapperException e) {
			throw e.asWebApplicationException();
		}
	}

	@GET
	@Path("user/{username}")
	@Produces(MediaType.APPLICATION_JSON)
	public User getUser(@Context User user, @PathParam("username") String username) {
		assertAdministrator(user);
		try {
			return api.getUser(username);
		} catch (CodeMapperException e) {
			throw e.asWebApplicationException();
		}
	}

	@POST
	@Path("user/{username}")
	@Produces(MediaType.APPLICATION_JSON)
	public void getUser(@Context User user, @PathParam("username") String username, @FormParam("password") String password, @FormParam("permissions") Map<String, Set<ProjectPermission>> permissions, @FormParam("isAdministrator") boolean isAdmin, @FormParam("email") String email) {
		assertAdministrator(user);
		try {
			api.updateUser(username, password, isAdmin, email);
		} catch (CodeMapperException e) {
			throw e.asWebApplicationException();
		}
	}
	
	@POST
	@Path("user")
	@Produces(MediaType.APPLICATION_JSON)
	public boolean createUser(@FormParam("username") String username, @FormParam("password") String password, @FormParam("email") String email, @Context HttpServletRequest request, @Context User user) {
		assertAdministrator(user);
		try {
			api.createUser(username, password, email);
			return true;
		} catch (CodeMapperException e) {
			throw e.asWebApplicationException();
		}
	}
	
	@GET
	@Path("project")
	@Produces(MediaType.APPLICATION_JSON)
	public List<String> getProjects(@Context User user) {
		assertAdministrator(user);
		try {
			return api.getProjects();
		} catch (CodeMapperException e) {
			throw e.asWebApplicationException();
		}
	}
	
	@GET
	@Path("project")
	@Produces(MediaType.APPLICATION_JSON)
	public List<String> createProject(@Context User user, @PathParam("project") String project) {
		assertAdministrator(user);
		try {
			return api.createProject(project);
		} catch (CodeMapperException e) {
			throw e.asWebApplicationException();
		}
	}
	
	@GET
	@Path("project/{project}")
	@Produces(MediaType.APPLICATION_JSON)
	public List<String> getProjects(@PathParam("project") String project, @Context User user) {
		assertAdministrator(user);
		try {
			return api.getProject(project);
		} catch (CodeMapperException e) {
			throw e.asWebApplicationException();
		}
	}
	
	@GET
	@Path("project-users/{project")
	@Produces(MediaType.APPLICATION_JSON)
	public List<String> getProjectUsers(@PathParam("project") String project, @Context User user) {
		assertAdministrator(user);
		try {
			return api.getProjectUsers(project);
		} catch (CodeMapperException e) {
			throw e.asWebApplicationException();
		}
	}
	
	@POST
	@Path("project-users/{project")
	@Produces(MediaType.APPLICATION_JSON)
	public boolean setProjectUsers(@PathParam("project") String project, @FormParam("users") List<String> users, @Context User user) {
		assertAdministrator(user);
		try {
			return api.setProjectUsers(project, users);
		} catch (CodeMapperException e) {
			throw e.asWebApplicationException();
		}
	}
}
