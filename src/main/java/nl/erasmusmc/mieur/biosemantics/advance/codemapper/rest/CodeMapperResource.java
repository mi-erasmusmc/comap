package nl.erasmusmc.mieur.biosemantics.advance.codemapper.rest;

import java.util.List;

import javax.ws.rs.BadRequestException;
import javax.ws.rs.FormParam;
import javax.ws.rs.GET;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;

import nl.erasmusmc.mieur.biosemantics.advance.codemapper.CodingSystem;
import nl.erasmusmc.mieur.biosemantics.advance.codemapper.UmlsConcept;
import nl.erasmusmc.mieur.biosemantics.advance.codemapper.api.CodeMapperException;
import nl.erasmusmc.mieur.biosemantics.advance.codemapper.api.UmlsApi;

import org.apache.log4j.Logger;

@Path("code-mapper")
public class CodeMapperResource {

	private static Logger logger = Logger.getLogger("CodeMapperWebService");
	private final static String VERSION = "$Revision$";

	@GET
	@Path("version")
	@Produces(MediaType.APPLICATION_JSON)
	public String version() {
		return VERSION;
	}

	@GET
	@Path("coding-systems")
	@Produces(MediaType.APPLICATION_JSON)
	public List<CodingSystem> getCodingSystems() {
		try {
			UmlsApi api = CodeMapperApplication.getApi();
			return api.getCodingSystems();
		} catch (CodeMapperException e) {
			e.printStackTrace();
			System.out.println(e);
			throw new BadRequestException(e);
		}
	}

	@POST
	@Path("umls-concepts")
	@Produces(MediaType.APPLICATION_JSON)
	public List<UmlsConcept> getUmlsConcepts(@FormParam("cuis") List<String> cuis,
			@FormParam("vocabularies") List<String> vocabularies, @FormParam("expand") List<String> expand) {
		try {
			UmlsApi api = CodeMapperApplication.getApi();
			return api.getConcepts(cuis, vocabularies, expand);
		} catch (CodeMapperException e) {
			logger.error(e);
			e.printStackTrace();
			throw new BadRequestException(e);
		}
	}
}
