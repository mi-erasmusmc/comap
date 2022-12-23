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
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.HashMap;

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
import org.biosemantics.codemapper.ClientState;
import org.biosemantics.codemapper.CodeMapperException;
import org.biosemantics.codemapper.Comment;
import org.biosemantics.codemapper.SourceConcept;
import org.biosemantics.codemapper.authentification.AuthentificationApi;
import org.biosemantics.codemapper.authentification.ProjectPermission;
import org.biosemantics.codemapper.authentification.User;
import org.biosemantics.codemapper.persistency.PersistencyApi;
import org.biosemantics.codemapper.rest.CodeMapperApplication;

import com.fasterxml.jackson.core.JsonProcessingException;


@Path("services/download")
public class DownloadResource {

    private static Logger logger = LogManager.getLogger(DownloadResource.class);
    
    public Response getCaseDefinition(String project, String caseDefinition, String url, final WriteApis.Api writeApi, final boolean includeDescendants) {
        try {
            PersistencyApi persistencyApi = CodeMapperApplication.getPersistencyApi();
            final String jsonState = persistencyApi.getCaseDefinition(project, caseDefinition);
            if (jsonState == null)
                throw new WebApplicationException(404);
            final ClientState.State state = new ClientState().ofJson(jsonState);
            Map<String, Map<String, Collection<SourceConcept>>> descendants;
            if (includeDescendants) {
                descendants = CodeMapperApplication.getDescendantsApi().getDescendants(state.codingSystems, state.mapping.concepts);
            } else {
                descendants = new HashMap<>();
            };
            final List<Comment> comments = persistencyApi.getComments(project, caseDefinition);
            String filename = String.format("%s - %s.%s", project, caseDefinition, writeApi.getFileExtension());
            String contentDisposition = String.format("attachment; filename=\"%s\"", filename);
            return Response.ok(new StreamingOutput() {
                @Override
                public void write(OutputStream output) throws IOException, WebApplicationException {
                    writeApi.write(output, state, descendants, comments, caseDefinition, url);
                }
            }, writeApi.getMimetype()).header("Content-Disposition", contentDisposition).build();
        } catch(CodeMapperException e) {
            logger.error("Cannot load case definition " + project + "/" + caseDefinition, e);
            throw new InternalServerErrorException(e);
        } catch (JsonProcessingException e) {
            logger.error("Cannot parse client state for " + project + "/" + caseDefinition, e);
            throw new InternalServerErrorException(e);
        }
    }

	@GET
	@Path("case-definition-xls")
	@Produces({WriteXlsApi.MIME_TYPE})
	public Response getCaseDefinitonXls(@Context HttpServletRequest request, @Context User user, @QueryParam("project") final String project, @QueryParam("caseDefinition") final String caseDefinition, @QueryParam("url") final String url, @QueryParam("includeDescendants") final boolean includeDescendants) {
		AuthentificationApi.assertProjectRoles(user, project, ProjectPermission.Editor, ProjectPermission.Commentator);
		logger.debug(String.format("Download case definition as XLS %s/%s (%s)", project, caseDefinition, user));
		return getCaseDefinition(project, caseDefinition, url, CodeMapperApplication.getWriteXlsApi(), includeDescendants);
	}

    @GET
    @Path("case-definition-tsv")
    @Produces({WriteTsvApi.MIME_TYPE})
    public Response getCaseDefinitonTsv(@Context HttpServletRequest request, @Context User user, @QueryParam("project") final String project, @QueryParam("caseDefinition") final String caseDefinition, @QueryParam("url") final String url, @QueryParam("includeDescendants") final boolean includeDescendants) {
        AuthentificationApi.assertProjectRoles(user, project, ProjectPermission.Editor, ProjectPermission.Commentator);
        logger.debug(String.format("Download case definition as TSV %s/%s (%s)", project, caseDefinition, user));
        return getCaseDefinition(project, caseDefinition, url, CodeMapperApplication.getWriteTsvApi(), includeDescendants);
    }


	@GET
	@Path("test")
	public Response test(@Context HttpServletRequest request) {
		return Response.ok("ok").build();
	}
}
