package org.biosemantics.codemapper.descendants;

import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;

import org.biosemantics.codemapper.ClientState;
import org.biosemantics.codemapper.CodeMapperException;
import org.biosemantics.codemapper.SourceConcept;

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

	Map<String, SpecificDescender> specificDescenders;
	GeneralDescender generalDescender;

	public DescendersApi(GeneralDescender generalDescender) {
		this.generalDescender = generalDescender;
		this.specificDescenders = new HashMap<>();
	}
	
	public void add(SpecificDescender specificDescender) {
		this.specificDescenders.put(specificDescender.getCodingSystem(), specificDescender);
	}

	public Map<String, Collection<SourceConcept>> getDescendants(String codingSystem, Collection<String> codes)
			throws CodeMapperException {
		if (specificDescenders.containsKey(codingSystem)) {
			return specificDescenders.get(codingSystem).getDescendants(codes);
		} else {
			return generalDescender.getDescendants(codes, codingSystem);
		}
	}
	
	public Map<String, Map<String, Collection<SourceConcept>>> getDescendants(String[] codingSystems, ClientState.Concept[] concepts) 
			throws CodeMapperException {
		Map<String, Map<String, Collection<SourceConcept>>> result = new HashMap<>();
		for (String codingSystem : codingSystems) {
			Collection<String> codes = new HashSet<>();
			for (ClientState.Concept concept : concepts) {
				for (ClientState.SourceConcept sourceConcept : concept.codes.get(codingSystem)) {
                    codes.add(sourceConcept.id);
                }
            }
			result.put(codingSystem, getDescendants(codingSystem, codes));
		}
		return result;
	}
}
