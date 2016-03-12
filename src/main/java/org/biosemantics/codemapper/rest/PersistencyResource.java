package org.biosemantics.codemapper.rest;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Set;

import javax.servlet.http.HttpServletRequest;
import javax.ws.rs.FormParam;
import javax.ws.rs.GET;
import javax.ws.rs.InternalServerErrorException;
import javax.ws.rs.NotFoundException;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.SecurityContext;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.biosemantics.codemapper.CodeMapperException;
import org.biosemantics.codemapper.Comment;
import org.biosemantics.codemapper.authentification.ProjectPermission;
import org.biosemantics.codemapper.authentification.User;
import org.biosemantics.codemapper.persistency.PersistencyApi;

@Path("persistency")
public class PersistencyResource {
    
    private static Logger logger = LogManager.getLogger(PersistencyResource.class);

	private @Context SecurityContext sc;

	private PersistencyApi api = CodeMapperApplication.getPersistencyApi();

	/** Test if user has any of the projectPermissions in a project. */
	public static void assertProjectRoles(User user, String project, ProjectPermission... projectPermissions) {
		AuthentificationResource.assertAuthentificated(user);
		Set<ProjectPermission> perms = user.getProjectPermissions().get(project);
		if (perms != null && !Collections.disjoint(perms, Arrays.asList(projectPermissions)))
			return;
		throw new UnauthorizedException();
	}

	@GET
	@Path("project-permissions")
	@Produces(MediaType.APPLICATION_JSON)
	public Map<String, Set<ProjectPermission>> getProjectPermissions(@Context HttpServletRequest request, @Context User user) {
		AuthentificationResource.assertAuthentificated(user);
		try {
			return api.getProjectPermissions(user.getUsername());
		} catch (CodeMapperException e) {
			System.err.println("Couldn't get projects");
			e.printStackTrace();
			throw new InternalServerErrorException(e);
		}
	}

	@GET
	@Path("projects/{project}/users")
	@Produces(MediaType.APPLICATION_JSON)
	public Map<String, Set<ProjectPermission>> getUsersOfProject(@PathParam("project") String project, @Context HttpServletRequest request, @Context User user) {
		assertProjectRoles(user, project, ProjectPermission.Editor, ProjectPermission.Commentator);
		try {
			return api.getUsersOfProject(project);
		} catch (CodeMapperException e) {
			System.err.println("Couldn't get case definitions");
			e.printStackTrace();
			throw new InternalServerErrorException(e);
		}
	}

	@GET
	@Path("projects/{project}/case-definitions")
	@Produces(MediaType.APPLICATION_JSON)
	public List<String> getCaseDefinitionNames(@PathParam("project") String project, @Context User user) {
		assertProjectRoles(user, project, ProjectPermission.Editor, ProjectPermission.Commentator);
		try {
			return api.getCaseDefinitionsNames(project);
		} catch (CodeMapperException e) {
			System.err.println("Couldn't get case definitions");
			e.printStackTrace();
			throw new InternalServerErrorException(e);
		}
	}

	@GET
	@Path("projects/{project}/case-definitions/{name}")
	@Produces(MediaType.APPLICATION_JSON)
	public String getCaseDefinition(@PathParam("project") String project, @PathParam("name") String name, @Context User user) {
		logger.debug(String.format("Get case definition %s", name));
		assertProjectRoles(user, project, ProjectPermission.Editor, ProjectPermission.Commentator);
		try {
			String stateJson = api.getCaseDefinition(project, name);
			if (stateJson != null)
				return stateJson;
			else
				throw new NotFoundException();
		} catch (CodeMapperException e) {
			System.err.println("Couldn't get case definition");
			e.printStackTrace();
			throw new InternalServerErrorException(e);
		}
	}

	@POST
	@Path("projects/{project}/case-definitions/{name}")
	@Produces(MediaType.APPLICATION_JSON)
	public void setCaseDefinition(@PathParam("project") String project, @PathParam("name") String name, @FormParam("state") String stateJson, @Context User user) {
		logger.debug(String.format("Set case definition %s", name));
		assertProjectRoles(user, project, ProjectPermission.Editor);
		try {
			api.setCaseDefinition(project, name, stateJson);
		} catch (CodeMapperException e) {
			System.err.println("Couldn't save case definition");
			e.printStackTrace();
			throw new InternalServerErrorException(e);
		}
	}

	@GET
	@Path("projects/{project}/case-definitions/{case-definition}/comments")
	@Produces(MediaType.APPLICATION_JSON)
	public List<Comment> getComments(@PathParam("project") String project, @PathParam("case-definition") String caseDefinition, @Context User user) {
		assertProjectRoles(user, project, ProjectPermission.Editor, ProjectPermission.Commentator);
		try {
			return api.getComments(project, caseDefinition);
		} catch (CodeMapperException e) {
			System.err.println("Couldn't get comments");
			e.printStackTrace();
			throw new InternalServerErrorException(e);
		}
	}

	@POST
	@Path("projects/{project}/case-definitions/{case-definition}/comments")
	@Produces(MediaType.APPLICATION_JSON)
	public void createComment(@PathParam("project") String project, @PathParam("case-definition") String caseDefinition, @Context User user,
			@FormParam("cui") String cui, @FormParam("comment") String comment) {
		assertProjectRoles(user, project, ProjectPermission.Editor, ProjectPermission.Commentator);
		try {
			api.createComment(project, caseDefinition, user, cui, comment);
		} catch (CodeMapperException e) {
			System.err.println("Couldn't create comment");
			e.printStackTrace();
			throw new InternalServerErrorException(e);
		}
	}
}
