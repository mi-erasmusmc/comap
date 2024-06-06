package org.biosemantics.codemapper.rest;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Set;
import javax.servlet.http.HttpServletRequest;
import javax.ws.rs.FormParam;
import javax.ws.rs.GET;
import javax.ws.rs.InternalServerErrorException;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.QueryParam;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.biosemantics.codemapper.CodeMapperException;
import org.biosemantics.codemapper.authentification.AuthentificationApi;
import org.biosemantics.codemapper.authentification.ProjectPermission;
import org.biosemantics.codemapper.authentification.User;
import org.biosemantics.codemapper.review.ReviewApi.AllTopics;

@Path("review")
public class ReviewResource {
  private static Logger logger = LogManager.getLogger(ReviewResource.class);

  @GET
  @Path("topics/{project}/{caseDefinition}")
  @Produces(MediaType.APPLICATION_JSON)
  public AllTopics getTopicsByCui(
      @Context HttpServletRequest request,
      @Context User user,
      @PathParam("project") String project,
      @PathParam("caseDefinition") String caseDefinition) {
    AuthentificationApi.assertProjectRoles(
        user, project, ProjectPermission.Editor, ProjectPermission.Commentator);
    try {
      return CodeMapperApplication.getReviewApi()
          .getAll(project, caseDefinition, user.getUsername());
    } catch (CodeMapperException e) {
      e.printStackTrace();
      throw new InternalServerErrorException(e);
    }
  }

  @POST
  @Path("topic/{project}/{caseDefinition}")
  @Produces(MediaType.APPLICATION_JSON)
  public int postNewTopic(
      @Context HttpServletRequest request,
      @Context User user,
      @PathParam("project") String project,
      @PathParam("caseDefinition") String caseDefinition,
      @QueryParam("cui") String cui,
      @QueryParam("sab") String sab,
      @QueryParam("code") String code,
      @FormParam("heading") String heading) {
    AuthentificationApi.assertProjectRoles(
        user, project, ProjectPermission.Editor, ProjectPermission.Commentator);
    try {
      return CodeMapperApplication.getReviewApi()
          .newTopic(project, caseDefinition, cui, sab, code, heading, user.getUsername(), null);
    } catch (CodeMapperException e) {
      e.printStackTrace();
      throw new InternalServerErrorException(e);
    }
  }

  @POST
  @Path("message/{project}/{caseDefinition}/{topicId}")
  @Produces(MediaType.APPLICATION_JSON)
  public void newMessage(
      @Context HttpServletRequest request,
      @Context User user,
      @PathParam("project") String project,
      @PathParam("caseDefinition") String caseDefinition,
      @PathParam("topicId") int topicId,
      @FormParam("content") String content) {
    AuthentificationApi.assertProjectRoles(
        user, project, ProjectPermission.Editor, ProjectPermission.Commentator);
    try {
      CodeMapperApplication.getReviewApi()
          .newMessage(project, caseDefinition, topicId, content, user.getUsername(), null);
    } catch (CodeMapperException e) {
      e.printStackTrace();
      throw new InternalServerErrorException(e);
    }
  }

  @POST
  @Path("topic-resolve/{project}/{caseDefinition}/{topicId}")
  @Produces(MediaType.APPLICATION_JSON)
  public void resolveTopic(
      @Context HttpServletRequest request,
      @Context User user,
      @PathParam("project") String project,
      @PathParam("caseDefinition") String caseDefinition,
      @PathParam("topicId") int topicId) {
    Set<ProjectPermission> perms = user.getProjectPermissions().get(project);
    try {
      String createdBy = CodeMapperApplication.getReviewApi().getTopicCreatedBy(topicId);
      if (!perms.contains(ProjectPermission.Editor)
          && createdBy != null
          && !user.getUsername().equals(createdBy)) {
        throw new UnauthorizedException();
      }
      CodeMapperApplication.getReviewApi().resolveTopic(topicId, user.getUsername(), null);
      CodeMapperApplication.getReviewApi().resetReadMarkers(topicId);
    } catch (CodeMapperException e) {
      e.printStackTrace();
      throw new InternalServerErrorException(e);
    }
  }

  @POST
  @Path("topic-mark-read/{project}/{caseDefinition}/{topicId}")
  @Produces(MediaType.APPLICATION_JSON)
  public void markRead(
      @Context HttpServletRequest request,
      @Context User user,
      @PathParam("project") String project,
      @PathParam("caseDefinition") String caseDefinition,
      @PathParam("topicId") int topicId) {
    AuthentificationApi.assertProjectRoles(
        user, project, ProjectPermission.Editor, ProjectPermission.Commentator);
    try {
      CodeMapperApplication.getReviewApi().markRead(topicId, user.getUsername());
    } catch (CodeMapperException e) {
      e.printStackTrace();
      throw new InternalServerErrorException(e);
    }
  }

  @POST
  @Path("topics/{project}/{caseDefinition}")
  @Produces(MediaType.APPLICATION_JSON)
  public void saveReviews(
      @Context HttpServletRequest request,
      @Context User user,
      @PathParam("project") String project,
      @PathParam("caseDefinition") String caseDefinition,
      @FormParam("allTopics") String allTopicsJson) {
    AuthentificationApi.assertProjectRoles(
        user, project, ProjectPermission.Editor, ProjectPermission.Commentator);
    try {
      ObjectMapper mapper = new ObjectMapper();
      mapper.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
      AllTopics allTopics = mapper.readValue(allTopicsJson, AllTopics.class);
      logger.info("Save reviews with messages " + allTopics.numMessages());
      CodeMapperApplication.getPersistencyApi().ensureUsers(allTopics.allUsers());
      CodeMapperApplication.getReviewApi().saveReviews(project, caseDefinition, allTopics);
    } catch (CodeMapperException | JsonProcessingException e) {
      e.printStackTrace();
      throw new InternalServerErrorException(e);
    }
  }
}
