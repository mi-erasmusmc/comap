package nl.erasmusmc.mieur.biosemantics.advance.codemapper.rest;

import java.util.List;

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

import nl.erasmusmc.mieur.biosemantics.advance.codemapper.CodeMapperException;
import nl.erasmusmc.mieur.biosemantics.advance.codemapper.authentification.User;
import nl.erasmusmc.mieur.biosemantics.advance.codemapper.persistency.Comment;
import nl.erasmusmc.mieur.biosemantics.advance.codemapper.persistency.PersistencyApi;

import org.apache.log4j.Logger;

@Path("persistency")
public class PersistencyResource {

	private static Logger logger = Logger.getLogger("CodeMapperWebService");

	private @Context SecurityContext sc;

	private PersistencyApi api = CodeMapperApplication.getPersistencyApi();

	private static void assertAdminOrProjectMember(User user, String project) {
		AuthentificationResource.assertAuthentificated(user);
		if (!user.isAdmin() && !user.getProjects().contains(project))
			throw new UnauthorizedException();
	}

	@GET
	@Path("projects")
	@Produces(MediaType.APPLICATION_JSON)
	public List<String> getProjects(@Context HttpServletRequest request, @Context User user) {
		AuthentificationResource.assertAuthentificated(user);
		try {
			if (user.isAdmin())
				return api.getProjects();
			else
				return api.getProjects(user.getUsername());
		} catch (CodeMapperException e) {
			System.err.println("Couldn't get projects");
			e.printStackTrace();
			throw new InternalServerErrorException(e);
		}
	}

	@GET
	@Path("projects/{project}/users")
	@Produces(MediaType.APPLICATION_JSON)
	public List<String> getUsersOfProject(@PathParam("project") String project, @Context HttpServletRequest request, @Context User user) {
		assertAdminOrProjectMember(user, project);
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
		assertAdminOrProjectMember(user, project);
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
		assertAdminOrProjectMember(user, project);
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
		assertAdminOrProjectMember(user, project);
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
		assertAdminOrProjectMember(user, project);
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
		assertAdminOrProjectMember(user, project);
		try {
			api.createComment(project, caseDefinition, user, cui, comment);
		} catch (CodeMapperException e) {
			System.err.println("Couldn't create comment");
			e.printStackTrace();
			throw new InternalServerErrorException(e);
		}
	}
}
