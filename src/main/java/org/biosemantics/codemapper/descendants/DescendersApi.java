package org.biosemantics.codemapper.descendants;

import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;

import org.biosemantics.codemapper.CodeMapperException;
import org.biosemantics.codemapper.SourceConcept;
import org.json.JSONArray;
import org.json.JSONObject;

public class DescendersApi {

	public static interface SpecificDescender {

		/**
		 * Returns the coding system for which the specific descender retrieves codes
		 */
		public String getCodingSystem();

		/**
		 * Returns a mapping of each of the argument codes to a collection of descendant
		 * codes.
		 */
		public Map<String, Collection<SourceConcept>> getDescendants(Collection<String> codes)
				throws CodeMapperException;
	}

	public static interface GeneralDescender {
		
		/**
		 * Returns a mapping of each of the argument codes to a collection of descendant
		 * codes.
		 */
		public Map<String, Collection<SourceConcept>> getDescendants(Collection<String> codes, String codingSystem)
				throws CodeMapperException;
	}

	public static Map<String, SpecificDescender> specificDescenders(SpecificDescender... descenders) {
		Map<String, SpecificDescender> descendersMap = new HashMap<>();
		for (SpecificDescender descender : descenders) {
			descendersMap.put(descender.getCodingSystem(), descender);
		}
		return descendersMap;
	}

	Map<String, SpecificDescender> specificDescenders;
	GeneralDescender generalDescender;

	public DescendersApi(Map<String, SpecificDescender> specificDescenders, GeneralDescender generalDescender) {
		this.specificDescenders = specificDescenders;
		this.generalDescender = generalDescender;
	}

	public Map<String, Collection<SourceConcept>> getDescendants(String codingSystem, Collection<String> codes)
			throws CodeMapperException {
		if (specificDescenders.containsKey(codingSystem)) {
			return specificDescenders.get(codingSystem).getDescendants(codes);
		} else {
			return generalDescender.getDescendants(codes, codingSystem);
		}
	}
	
	public Map<String, Map<String, Collection<SourceConcept>>> getDescendants(JSONObject state) 
			throws CodeMapperException {
		Map<String, Map<String, Collection<SourceConcept>>> result = new HashMap<>();
		JSONArray codingSystems = state.getJSONArray("codingSystems");
		for (int codingSystemIx = 0; codingSystemIx < codingSystems.length(); codingSystemIx++) {
			String codingSystem = codingSystems.getString(codingSystemIx);
			Collection<String> codes0 = new HashSet<>();
			JSONArray concepts = state.getJSONObject("mapping").getJSONArray("concepts");
            for (int conceptIx = 0; conceptIx < concepts.length(); conceptIx++) {
                JSONObject concept = concepts.getJSONObject(conceptIx);
                JSONArray codes = concept.getJSONObject("codes").getJSONArray(codingSystem);
                for (int codeIx = 0; codeIx < codes.length(); codeIx++) {
                    JSONObject code = codes.getJSONObject(codeIx);
                    codes0.add(code.getString("id"));
                }
            }
			result.put(codingSystem, getDescendants(codingSystem, codes0));
		}
		return result;
	}
}
