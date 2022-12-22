package org.biosemantics.codemapper.rest;

import java.util.Map;

import javax.servlet.http.HttpServletRequest;
import javax.ws.rs.FormParam;
import javax.ws.rs.GET;
import javax.ws.rs.InternalServerErrorException;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;

import org.biosemantics.codemapper.CodeMapperException;
import org.biosemantics.codemapper.authentification.AuthentificationApi;
import org.biosemantics.codemapper.authentification.ProjectPermission;
import org.biosemantics.codemapper.authentification.User;
import org.biosemantics.codemapper.review.Topic;

@Path("review")
public class ReviewResource {
	
	@GET
	@Path("topics-by-cui/{project}/{caseDefinition}")
	@Produces(MediaType.APPLICATION_JSON)
	public Map<String, Map<Integer, Topic>> getTopicsByCui(@Context HttpServletRequest request, @Context User user, @PathParam("project") String project, @PathParam("caseDefinition") String caseDefinition) {
		AuthentificationApi.assertProjectRoles(user, project, ProjectPermission.Editor, ProjectPermission.Commentator);
		try {
			return CodeMapperApplication.getReviewApi().getAll(project, caseDefinition, user.getUsername());
		} catch (CodeMapperException e) {
			e.printStackTrace();
			throw new InternalServerErrorException(e);
		}
	}
	
	@POST
	@Path("new-topic/{project}/{caseDefinition}/{cui}")
	@Produces(MediaType.APPLICATION_JSON)
	public void postNewTopic(@Context HttpServletRequest request, @Context User user, @PathParam("project") String project, @PathParam("caseDefinition") String caseDefinition, @PathParam("cui") String cui, @FormParam("heading") String heading) {
		AuthentificationApi.assertProjectRoles(user, project, ProjectPermission.Editor, ProjectPermission.Commentator);
		try {
			CodeMapperApplication.getReviewApi().newTopic(project, caseDefinition, cui, heading, user.getUsername());
		} catch (CodeMapperException e) {
			e.printStackTrace();
			throw new InternalServerErrorException(e);
		}
	}
	
	@POST
	@Path("new-message/{project}/{caseDefinition}/{cui}/{topicId}")
	@Produces(MediaType.APPLICATION_JSON)
	public void newMessage(@Context HttpServletRequest request, @Context User user, @PathParam("project") String project, @PathParam("caseDefinition") String caseDefinition, @PathParam("cui") String cui, @PathParam("topicId") int topicId, @FormParam("content") String content) {
		AuthentificationApi.assertProjectRoles(user, project, ProjectPermission.Editor, ProjectPermission.Commentator);
		try {
			CodeMapperApplication.getReviewApi().newMessage(project, caseDefinition, cui, topicId, content, user.getUsername());
		} catch (CodeMapperException e) {
			e.printStackTrace();
			throw new InternalServerErrorException(e);
		}
	}
	
	@POST
	@Path("resolve-topic/{project}/{caseDefinition}/{cui}/{topicId}")
	@Produces(MediaType.APPLICATION_JSON)
	public void resolveTopic(@Context HttpServletRequest request, @Context User user, @PathParam("project") String project, @PathParam("caseDefinition") String caseDefinition, @PathParam("cui") String cui, @PathParam("topicId") int topicId) {
		AuthentificationApi.assertProjectRoles(user, project, ProjectPermission.Editor, ProjectPermission.Commentator);
		try {
			CodeMapperApplication.getReviewApi().resolveTopic(topicId, user.getUsername());
			CodeMapperApplication.getReviewApi().resetReadMarkers(topicId);
		} catch (CodeMapperException e) {
			e.printStackTrace();
			throw new InternalServerErrorException(e);
		}
	}
	
	@POST
	@Path("mark-topic-read/{project}/{caseDefinition}/{cui}/{topicId}")
	@Produces(MediaType.APPLICATION_JSON)
	public void markRead(@Context HttpServletRequest request, @Context User user, @PathParam("project") String project, @PathParam("caseDefinition") String caseDefinition, @PathParam("cui") String cui, @PathParam("topicId") int topicId) {
		AuthentificationApi.assertProjectRoles(user, project, ProjectPermission.Editor, ProjectPermission.Commentator);
		try {
			CodeMapperApplication.getReviewApi().markRead(topicId, user.getUsername());
		} catch (CodeMapperException e) {
			e.printStackTrace();
			throw new InternalServerErrorException(e);
		}
	}
}
