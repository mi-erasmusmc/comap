package nl.erasmusmc.mieur.biosemantics.advance.codemapper.rest;

import java.util.List;

import javax.ws.rs.BadRequestException;
import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.QueryParam;
import javax.ws.rs.core.MediaType;

import nl.erasmusmc.mieur.biosemantics.advance.codemapper.CodeMapperException;
import nl.erasmusmc.mieur.biosemantics.advance.codemapper.CodingSystem;
import nl.erasmusmc.mieur.biosemantics.advance.codemapper.UmlsApi;
import nl.erasmusmc.mieur.biosemantics.advance.codemapper.UmlsConcept;

import org.apache.log4j.Logger;

@Path("code-mapper")
public class CodeMapperResource {

	private static Logger logger = Logger.getLogger("CodeMapperWebService");
	
	@GET
	@Path("version")
	@Produces(MediaType.APPLICATION_JSON)
	public String version() {
		return "1.0";
	}

	@GET
	@Path("coding-systems")
	@Produces(MediaType.APPLICATION_JSON)
	public List<CodingSystem> getCodingSystems() {
		try {
			return UmlsApi.getInstance().getCodingSystems();
		} catch (CodeMapperException e) {
			logger.error(e);
			throw new BadRequestException(e);
		}
	}

	@GET
	@Path("umls-concepts")
	@Produces(MediaType.APPLICATION_JSON)
	public List<UmlsConcept> getUmlsConcepts(@QueryParam("cuis") List<String> cuis,
			@QueryParam("vocabularies") List<String> vocabularies) {
		try {
			UmlsApi api = UmlsApi.getInstance();
			return api.getUmlsConcepts(cuis, vocabularies);
		} catch (CodeMapperException e) {
			logger.error(e);
			throw new BadRequestException(e);
		}
	}
}
