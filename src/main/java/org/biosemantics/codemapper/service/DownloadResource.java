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
package org.biosemantics.codemapper.service;

import java.io.IOException;
import java.io.OutputStream;
import java.util.List;

import javax.servlet.http.HttpServletRequest;
import javax.ws.rs.ClientErrorException;
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
import org.biosemantics.codemapper.ClientState;
import org.biosemantics.codemapper.CodeMapperException;
import org.biosemantics.codemapper.Comment;
import org.biosemantics.codemapper.authentification.ProjectPermission;
import org.biosemantics.codemapper.authentification.User;
import org.biosemantics.codemapper.persistency.PersistencyApi;
import org.biosemantics.codemapper.rest.CodeMapperApplication;
import org.biosemantics.codemapper.rest.PersistencyResource;

import com.fasterxml.jackson.core.JsonProcessingException;


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
			final ClientState.State state = new ClientState().ofJson(jsonState);
			final List<Comment> comments = persistencyApi.getComments(project, caseDefinition);
			String filename = String.format("%s - %s.xls", project, caseDefinition);
			String contentDisposition = String.format("attachment; filename=\"%s\"", filename);
			return Response.ok(new StreamingOutput() {
					@Override
					public void write(OutputStream output) throws IOException, WebApplicationException {
						CodeMapperApplication.getWriteXlsApi().writeXls(output, state, comments, caseDefinition, url);
					}
				}).header("Content-Disposition", contentDisposition).build();
		} catch(CodeMapperException e) {
			logger.error("Cannot load case definition", e);
			throw new InternalServerErrorException(e);
		} catch (JsonProcessingException e) {
			logger.error("Cannot parse client state", e);
			throw new ClientErrorException(400);
		}
	}

	@GET
	@Path("test")
	public Response test(@Context HttpServletRequest request) {
		return Response.ok("ok").build();
	}
}
