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
import org.biosemantics.codemapper.authentification.AuthentificationApi;
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
		AuthentificationApi.assertAuthentificated(user);
		return VERSION;
	}

	@GET
	@Path("autocomplete")
	@Produces(MediaType.APPLICATION_JSON)
	public List<UmlsConcept> getConceptCompletions(@Context User user,
			@QueryParam("str") String str,
			@QueryParam("codingSystems") List<String> codingSystems) {
		AuthentificationApi.assertAuthentificated(user);
		try {
			return api.getCompletions(str, codingSystems);
		} catch (CodeMapperException e) {
			throw e.asWebApplicationException();
		}
	}

    @GET
    @Path("autocomplete-code")
    @Produces(MediaType.APPLICATION_JSON)
    public List<UmlsConcept> getCodeCompletions(@Context User user,
            @QueryParam("str") String str,
            @QueryParam("codingSystem") String codingSystem) {
        AuthentificationApi.assertAuthentificated(user);
        try {
            List<UmlsConcept> res = api.getCodeCompletions(str, codingSystem);
            System.out.println(res);
            return res;
        } catch (CodeMapperException e) {
            throw e.asWebApplicationException();
        }
    }

	@GET
	@Path("coding-systems")
	@Produces(MediaType.APPLICATION_JSON)
	public List<CodingSystem> getCodingSystems(@Context User user) {
		AuthentificationApi.assertAuthentificated(user);
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
        AuthentificationApi.assertAuthentificated(user);
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
        AuthentificationApi.assertAuthentificated(user);
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
		AuthentificationApi.assertAuthentificated(user);
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
		AuthentificationApi.assertAuthentificated(user);
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
		AuthentificationApi.assertAuthentificated(user);
		return getHyponymsOrHypernyms(cuis, codingSystems, true, user);
	}

	@POST
	@Path("related/hypernyms")
	@Produces(MediaType.APPLICATION_JSON)
	public Map<String, List<UmlsConcept>> getHypernyms(@FormParam("cuis") List<String> cuis,
			@FormParam("codingSystems") List<String> codingSystems,
			@Context User user) {
		AuthentificationApi.assertAuthentificated(user);
		return getHyponymsOrHypernyms(cuis, codingSystems, false, user);
	}

	@POST
	@Path("related-hypernyms-or-hyponyms")
	@Produces(MediaType.APPLICATION_JSON)
	public Map<String, List<UmlsConcept>> getHyponymsOrHypernyms(@FormParam("cuis") List<String> cuis,
			@FormParam("codingSystems") List<String> codingSystems,
			@FormParam("hyponymsNotHypernyms") boolean hyponymsNotHypernyms,
			@Context User user) {
		AuthentificationApi.assertAuthentificated(user);
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
		AuthentificationApi.assertAuthentificated(user);
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
        AuthentificationApi.assertAuthentificated(user);
        try {
            return api.getSimilarConcepts(cuis, missingCodingSystems, codingSystems, excludeCuis);
        } catch (CodeMapperException e) {
            throw e.asWebApplicationException();
        }
	}
	
	@POST
	@Path("search-uts")
	@Produces(MediaType.APPLICATION_JSON)
	public List<String> searchConcepts(
	        @FormParam("query") String query,
	        @Context User user) {
	    AuthentificationApi.assertAuthentificated(user);
	    try {
	        return CodeMapperApplication.getUtsApi().searchConcepts(query, CodeMapperApplication.getUmlsVersion());
	    } catch (CodeMapperException e) {
	        throw e.asWebApplicationException();
	    }
	}
}
