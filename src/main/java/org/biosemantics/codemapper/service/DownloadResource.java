package org.biosemantics.codemapper.service;

import java.io.IOException;
import java.io.OutputStream;
import java.util.List;

import javax.servlet.http.HttpServletRequest;
import javax.ws.rs.GET;
import javax.ws.rs.InternalServerErrorException;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.QueryParam;
import javax.ws.rs.WebApplicationException;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.StreamingOutput;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.biosemantics.codemapper.CodeMapperException;
import org.biosemantics.codemapper.Comment;
import org.biosemantics.codemapper.authentification.ProjectPermission;
import org.biosemantics.codemapper.authentification.User;
import org.biosemantics.codemapper.persistency.PersistencyApi;
import org.biosemantics.codemapper.rest.CodeMapperApplication;
import org.biosemantics.codemapper.rest.PersistencyResource;
import org.json.JSONObject;


@Path("services/download")
public class DownloadResource {
	
    private static Logger logger = LogManager.getLogger(DownloadResource.class);

	@GET
	@Path("case-definition-xls")
	@Produces({"application/vnd.ms-excel"})
	public Response getCaseDefinitonXls(@Context HttpServletRequest request, @Context User user, @QueryParam("project") final String project, @QueryParam("caseDefinition") final String caseDefinition, @QueryParam("url") final String url) {
		PersistencyResource.assertProjectRoles(user, project, ProjectPermission.Editor, ProjectPermission.Commentator);
		logger.debug(String.format("Download case definition %s/%s (%s)", project, caseDefinition, user));
		try {
			PersistencyApi persistencyApi = CodeMapperApplication.getPersistencyApi();
			final String jsonState = persistencyApi.getCaseDefinition(project, caseDefinition);
			if (jsonState == null)
				throw new WebApplicationException(404);
			final List<Comment> comments = persistencyApi.getComments(project, caseDefinition);
			String filename = String.format("%s - %s.xls", project, caseDefinition);
			String contentDisposition = String.format("attachment; filename=\"%s\"", filename);
			return Response.ok(new StreamingOutput() {
					@Override
					public void write(OutputStream output) throws IOException, WebApplicationException {
						JSONObject state = new JSONObject(jsonState);
						CodeMapperApplication.getDownloadApi().caseDefinitionToXls(state, comments, caseDefinition, url, output);
					}
				}).header("Content-Disposition", contentDisposition).build();
		} catch(CodeMapperException e) {
			logger.error("Cannot load case definition", e);
			throw new InternalServerErrorException(e);
		}
	}
	
	@GET
	@Path("test")
	public Response test(@Context HttpServletRequest request) {
		return Response.ok("ok").build();
	}
}
