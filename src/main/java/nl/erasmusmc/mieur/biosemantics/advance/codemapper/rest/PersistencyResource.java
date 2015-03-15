package nl.erasmusmc.mieur.biosemantics.advance.codemapper.rest;

import java.util.List;

import javax.ws.rs.FormParam;
import javax.ws.rs.GET;
import javax.ws.rs.NotFoundException;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;

import nl.erasmusmc.mieur.biosemantics.advance.codemapper.persistency.PersistencyApi;

import org.apache.log4j.Logger;

@Path("persistency")
public class PersistencyResource {

	private static Logger logger = Logger.getLogger("CodeMapperWebService");

	@GET
	@Path("projects")
	@Produces(MediaType.APPLICATION_JSON)
	public List<String> getCaseDefinitionNames() {
		PersistencyApi api = CodeMapperApplication.getPersistencyApi();
		return api.getProjects();
	}

	@GET
	@Path("projects/{project}")
	@Produces(MediaType.APPLICATION_JSON)
	public List<String> getCaseDefinitionNames(@PathParam("project") String project) {
		PersistencyApi api = CodeMapperApplication.getPersistencyApi();
		return api.getCaseDefinitionsNames(project);
	}

	@GET
	@Path("projects/{project}/case-definitions/{name}")
	@Produces(MediaType.APPLICATION_JSON)
	public String getCaseDefinition(@PathParam("project") String project, @PathParam("name") String name) {
		logger.debug(String.format("Get case definition %s", name));
		PersistencyApi api = CodeMapperApplication.getPersistencyApi();
		String stateJson = api.getCaseDefinition(project, name);
		if (stateJson != null)
			return stateJson;
		else
			throw new NotFoundException();
	}

	@POST
	@Path("projects/{project}/case-definitions/{name}")
	@Produces(MediaType.APPLICATION_JSON)
	public void setCaseDefinition(@PathParam("project") String project, @PathParam("name") String name, @FormParam("state") String stateJson) {
		logger.debug(String.format("Set case definition %s", name));
		PersistencyApi api = CodeMapperApplication.getPersistencyApi();
		api.setCaseDefinition(project, name, stateJson);
	}
}
