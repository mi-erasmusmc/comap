package org.biosemantics.codemapper.rest;

import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

import javax.ws.rs.FormParam;
import javax.ws.rs.GET;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.QueryParam;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.biosemantics.codemapper.CodeMapperException;
import org.biosemantics.codemapper.CodingSystem;
import org.biosemantics.codemapper.UmlsApi;
import org.biosemantics.codemapper.UmlsConcept;
import org.biosemantics.codemapper.authentification.User;

@Path("code-mapper")
public class CodeMapperResource {

    private static Logger logger = LogManager.getLogger(CodeMapperResource.class);

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
	@Path("autocomplete")
	@Produces(MediaType.APPLICATION_JSON)
	public List<UmlsConcept> getConceptCompletions(@Context User user,
			@QueryParam("str") String str,
			@QueryParam("codingSystems") List<String> codingSystems,
			@QueryParam("semanticTypes") List<String> semanticTypes) {
		AuthentificationResource.assertAuthentificated(user);
		try {
			return api.getCompletions(str, codingSystems, semanticTypes);
		} catch (CodeMapperException e) {
			throw e.asWebApplicationException();
		}
	}

	@GET
	@Path("coding-systems")
	@Produces(MediaType.APPLICATION_JSON)
	public List<CodingSystem> getCodingSystems(@Context User user) {
		AuthentificationResource.assertAuthentificated(user);
		try {
			return api.getCodingSystems();
		} catch (CodeMapperException e) {
			throw e.asWebApplicationException();
		}
	}
	
	@POST
	@Path("cuis-for-codes")
	@Produces(MediaType.APPLICATION_JSON)
	public List<String> getCuisForCodes(@FormParam("codes") List<String> codes, @FormParam("codingSystem") String codingSystem, @Context User user) {
        AuthentificationResource.assertAuthentificated(user);
        try {
            return api.getCuisByCodes(codes, codingSystem);
        } catch (CodeMapperException e) {
            throw e.asWebApplicationException();
        }
	}
    
    @POST
    @Path("known-codes")
    @Produces(MediaType.APPLICATION_JSON)
    public List<String> getKnownCodes(@FormParam("codes") List<String> codes, @FormParam("codingSystem") String codingSystem, @Context User user) {
        AuthentificationResource.assertAuthentificated(user);
        try {
            return api.getKnownCodes(codes, codingSystem);
        } catch (CodeMapperException e) {
            throw e.asWebApplicationException();
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
			throw e.asWebApplicationException();
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
		return getHyponymsOrHypernyms(cuis, codingSystems, true, user);
	}

	@POST
	@Path("related/hypernyms")
	@Produces(MediaType.APPLICATION_JSON)
	public Map<String, List<UmlsConcept>> getHypernyms(@FormParam("cuis") List<String> cuis,
			@FormParam("codingSystems") List<String> codingSystems,
			@Context User user) {
		AuthentificationResource.assertAuthentificated(user);
		return getHyponymsOrHypernyms(cuis, codingSystems, false, user);
	}

	@POST
	@Path("related-hypernyms-or-hyponyms")
	@Produces(MediaType.APPLICATION_JSON)
	public Map<String, List<UmlsConcept>> getHyponymsOrHypernyms(@FormParam("cuis") List<String> cuis,
			@FormParam("codingSystems") List<String> codingSystems,
			@FormParam("hyponymsNotHypernyms") boolean hyponymsNotHypernyms,
			@Context User user) {
		AuthentificationResource.assertAuthentificated(user);
		logger.debug(String.format("Get connected concepts %s of %s (%s)", hyponymsNotHypernyms ? "hypo" : "hyper", cuis, user));
		if (cuis.isEmpty())
			return new TreeMap<>();
		else {
			try {
				return api.getHyponymsOrHypernyms(cuis, codingSystems, hyponymsNotHypernyms);
			} catch (CodeMapperException e) {
				throw e.asWebApplicationException();
			}
		}
	}

	@POST
	@Path("related-concepts")
	@Produces(MediaType.APPLICATION_JSON)
	public Map<String, Map<String, List<UmlsConcept>>> getRelated(@FormParam("cuis") List<String> cuis,
			@FormParam("codingSystems") List<String> codingSystems,
			@FormParam("relations") List<String> relations,
			@Context User user) {
		AuthentificationResource.assertAuthentificated(user);
		try {
			return api.getRelated(cuis, codingSystems, relations);
		} catch (CodeMapperException e) {
			throw e.asWebApplicationException();
		}
	}
	
	@POST
	@Path("suggest-concepts")
	@Produces(MediaType.APPLICATION_JSON)
	public List<UmlsConcept> getSimilarConcepts(
	        @FormParam("cuis") List<String> cuis,
	        @FormParam("codingSystems") List<String> codingSystems,
	        @FormParam("missingCodingSystems") List<String> missingCodingSystems,
	        @FormParam("excludeCuis") List<String> excludeCuis,
	        @Context User user) {
        AuthentificationResource.assertAuthentificated(user);
        try {
            return api.getSimilarConcepts(cuis, missingCodingSystems, codingSystems, excludeCuis);
        } catch (CodeMapperException e) {
            throw e.asWebApplicationException();
        }
	}
}
