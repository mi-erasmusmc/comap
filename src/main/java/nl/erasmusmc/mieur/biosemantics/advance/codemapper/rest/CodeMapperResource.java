package nl.erasmusmc.mieur.biosemantics.advance.codemapper.rest;

import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

import javax.ws.rs.BadRequestException;
import javax.ws.rs.FormParam;
import javax.ws.rs.GET;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;

import nl.erasmusmc.mieur.biosemantics.advance.codemapper.CodeMapperException;
import nl.erasmusmc.mieur.biosemantics.advance.codemapper.CodingSystem;
import nl.erasmusmc.mieur.biosemantics.advance.codemapper.UmlsApi;
import nl.erasmusmc.mieur.biosemantics.advance.codemapper.UmlsConcept;

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
			@FormParam("vocabularies") List<String> vocabularies) {
		try {
			UmlsApi api = CodeMapperApplication.getApi();
			Map<String, UmlsConcept> concepts = api.getConcepts(cuis, vocabularies);
			return new LinkedList<>(concepts.values());
		} catch (CodeMapperException e) {
			logger.error(e);
			e.printStackTrace();
			throw new BadRequestException(e);
		}
	}

	@GET
	@Path("config")
	@Produces(MediaType.APPLICATION_JSON)
	public Response getConfig() {
		Map<String, String> config = new TreeMap<>();
		config.put("peregrineResourceUrl", CodeMapperApplication.getPeregrineResourceUrl());
		return Response.ok(config).build();
	}

	@POST
	@Path("related/hyponyms")
	@Produces(MediaType.APPLICATION_JSON)
	public Map<String, List<UmlsConcept>> getHyponyms(@FormParam("cuis") List<String> cuis, @FormParam("vocabularies") List<String> vocabularies) {
		return getRelated(cuis, vocabularies, true);
	}

	@POST
	@Path("related/hypernyms")
	@Produces(MediaType.APPLICATION_JSON)
	public Map<String, List<UmlsConcept>> getHypernyms(@FormParam("cuis") List<String> cuis, @FormParam("vocabularies") List<String> vocabularies) {
		return getRelated(cuis, vocabularies, false);
	}

	@POST
	@Path("related")
	@Produces(MediaType.APPLICATION_JSON)
	public Map<String, List<UmlsConcept>> getRelated(@FormParam("cuis") List<String> cuis, @FormParam("vocabularies") List<String> vocabularies, @FormParam("hyponymsNotHypernyms") boolean hyponymsNotHypernyms) {
		if (cuis.isEmpty())
			return new TreeMap<>();
		else {
			UmlsApi api = CodeMapperApplication.getApi();
			try {
				return api.getRelated(cuis, vocabularies, hyponymsNotHypernyms);
			} catch (CodeMapperException e) {
				logger.error(e);
				e.printStackTrace();
				throw new BadRequestException(e);
			}
		}
	}
}
