package org.biosemantics.codemapper.descendants;

import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;

import javax.ws.rs.client.ClientBuilder;
import javax.ws.rs.client.WebTarget;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.Response.Status.Family;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.biosemantics.codemapper.CodeMapperException;
import org.biosemantics.codemapper.SourceConcept;
import org.biosemantics.codemapper.descendants.DescendersApi.SpecificDescender;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

public class SnowstormDescender implements SpecificDescender {
	
	private static Logger logger = LogManager.getLogger(SnowstormDescender.class);

	public static final String SNOMEDCT_US = "SNOMEDCT_US";
	
	private final String baseUri;
	private final String branch;
	
	public SnowstormDescender(String baseUri, String branch) {
		this.baseUri = baseUri;
		this.branch = branch;
	}
	
	public String getCodingSystem() {
		return SNOMEDCT_US;
	}

	public Map<String, Collection<SourceConcept>> getDescendants(Collection<String> codes) 
			throws CodeMapperException {
		Map<String, Collection<SourceConcept>> descendants = new HashMap<>();
		for (String code : codes) {
			descendants.put(code, getDescendants(code));
		}
		return descendants;
	}
	
	@JsonIgnoreProperties(ignoreUnknown = true)
	public static class SnowstormError {
		String error;
		String message;
		@Override
		public String toString() {
			return error + ": " + message;
		}
	}

	public Collection<SourceConcept> getDescendants(String conceptId) throws CodeMapperException {
		String uri = String.format(
				"%s/%s/concepts/%s/descendants", baseUri, branch, conceptId);
		WebTarget target = ClientBuilder.newClient().target(uri);
		Collection<SourceConcept> descendants = new HashSet<>();
		int total, offset = 0;
		do {
			final Response response = target
					.queryParam("offset", offset)
					.request(MediaType.APPLICATION_JSON).get();
			if (response.getStatus() == 400) {
				SnowstormError err = response.readEntity(SnowstormError.class);
				logger.info("Error 400 " + err + " on " + target + " " + offset);
				break;
			} else if (response.getStatusInfo().getFamily() != Family.SUCCESSFUL) {
				throw CodeMapperException.server(
						"Cannot retrieve descendants from Snowstorm: " +
								response.getStatusInfo().getReasonPhrase());
			}
			DescendantsResult res = response.readEntity(DescendantsResult.class);
			for (DescendentsConcept descConcept : res.items) {
				SourceConcept sourceConcept = new SourceConcept();
				sourceConcept.setCodingSystem(SNOMEDCT_US);
				sourceConcept.setId(descConcept.conceptId);
				sourceConcept.setPreferredTerm(descConcept.fsn.term);
				descendants.add(sourceConcept);
			}
			total = res.total;
			offset = res.offset + res.items.length;
		} while (descendants.size() < total);
		return descendants;
	}

	public static class Fsn {
		String lang;
		String term;
	}

	@JsonIgnoreProperties(ignoreUnknown = true)
	public static class DescendentsConcept {
		String conceptId;
		Fsn fsn;
	}

	@JsonIgnoreProperties(ignoreUnknown = true)
	public static class DescendantsResult {
		DescendentsConcept[] items;
		int limit;
		int offset;
		int total;
	}

	public static void main(String[] args) throws CodeMapperException {
		SnowstormDescender descender = new SnowstormDescender("http://localhost:8081", "MAIN/2021-07-31");
		Collection<SourceConcept> descendants = descender.getDescendants("409631000");
		System.out.println("" + descendants.size());
		for (SourceConcept concept : descendants) {
			System.out.println("- " + concept);
		}
	}
}
