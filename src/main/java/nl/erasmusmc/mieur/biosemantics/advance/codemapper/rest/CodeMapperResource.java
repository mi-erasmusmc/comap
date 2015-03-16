package nl.erasmusmc.mieur.biosemantics.advance.codemapper.rest;

import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

import javax.ws.rs.FormParam;
import javax.ws.rs.GET;
import javax.ws.rs.InternalServerErrorException;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;

import nl.erasmusmc.mieur.biosemantics.advance.codemapper.CodeMapperException;
import nl.erasmusmc.mieur.biosemantics.advance.codemapper.CodingSystem;
import nl.erasmusmc.mieur.biosemantics.advance.codemapper.UmlsApi;
import nl.erasmusmc.mieur.biosemantics.advance.codemapper.UmlsConcept;
import nl.erasmusmc.mieur.biosemantics.advance.codemapper.authentification.User;

import org.apache.log4j.Logger;

@Path("code-mapper")
public class CodeMapperResource {

	private static Logger logger = Logger.getLogger("CodeMapperWebService");
	private final static String VERSION = "$Revision$";

	private UmlsApi api = CodeMapperApplication.getUmlsApi();

	@GET
	@Path("version")
	@Produces(MediaType.APPLICATION_JSON)
	public String version(@Context User user) {
		AuthentificationResource.assertAuthentificated(user);
		return VERSION;
	}

	@GET
	@Path("coding-systems")
	@Produces(MediaType.APPLICATION_JSON)
	public List<CodingSystem> getCodingSystems(@Context User user) {
		AuthentificationResource.assertAuthentificated(user);
		try {
			return api.getCodingSystems();
		} catch (CodeMapperException e) {
			e.printStackTrace();
			System.out.println(e);
			throw new InternalServerErrorException(e);
		}
	}

	@POST
	@Path("umls-concepts")
	@Produces(MediaType.APPLICATION_JSON)
	public List<UmlsConcept> getUmlsConcepts(@FormParam("cuis") List<String> cuis,
			@FormParam("codingSystems") List<String> codingSystems,
			@Context User user) {
		AuthentificationResource.assertAuthentificated(user);
		try {
			Map<String, UmlsConcept> concepts = api.getConcepts(cuis, codingSystems);
			return new LinkedList<>(concepts.values());
		} catch (CodeMapperException e) {
			logger.error(e);
			e.printStackTrace();
			throw new InternalServerErrorException(e);
		}
	}

	@GET
	@Path("config")
	@Produces(MediaType.APPLICATION_JSON)
	public Response getConfig(@Context User user) {
		AuthentificationResource.assertAuthentificated(user);
		Map<String, String> config = new TreeMap<>();
		config.put("peregrineResourceUrl", CodeMapperApplication.getPeregrineResourceUrl());
		return Response.ok(config).build();
	}

	@POST
	@Path("related/hyponyms")
	@Produces(MediaType.APPLICATION_JSON)
	public Map<String, List<UmlsConcept>> getHyponyms(@FormParam("cuis") List<String> cuis,
			@FormParam("codingSystems") List<String> codingSystems,
			@Context User user) {
		AuthentificationResource.assertAuthentificated(user);
		return getRelated(cuis, codingSystems, true, user);
	}

	@POST
	@Path("related/hypernyms")
	@Produces(MediaType.APPLICATION_JSON)
	public Map<String, List<UmlsConcept>> getHypernyms(@FormParam("cuis") List<String> cuis,
			@FormParam("codingSystems") List<String> codingSystems,
			@Context User user) {
		AuthentificationResource.assertAuthentificated(user);
		return getRelated(cuis, codingSystems, false, user);
	}

	@POST
	@Path("related")
	@Produces(MediaType.APPLICATION_JSON)
	public Map<String, List<UmlsConcept>> getRelated(@FormParam("cuis") List<String> cuis,
			@FormParam("codingSystems") List<String> codingSystems,
			@FormParam("hyponymsNotHypernyms") boolean hyponymsNotHypernyms,
			@Context User user) {
		AuthentificationResource.assertAuthentificated(user);
		if (cuis.isEmpty())
			return new TreeMap<>();
		else {
			try {
				return api.getRelated(cuis, codingSystems, hyponymsNotHypernyms);
			} catch (CodeMapperException e) {
				logger.error(e);
				e.printStackTrace();
				throw new InternalServerErrorException(e);
			}
		}
	}
}
