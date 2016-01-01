package nl.erasmusmc.mieur.biosemantics.advance.codemapper.umls_ext;

import java.util.Collection;
import java.util.List;
import java.util.Map;

import nl.erasmusmc.mieur.biosemantics.advance.codemapper.CodeMapperException;
import nl.erasmusmc.mieur.biosemantics.advance.codemapper.CodingSystem;
import nl.erasmusmc.mieur.biosemantics.advance.codemapper.SourceConcept;

public interface ExtCodingSystem {

	/** Extended coding system. */
	public CodingSystem getCodingSystem();

	/** Abbreviation of the reference coding system in UMLS. */
	public Collection<String> getReferenceCodingSystems();

	/**
	 * Map codes in reference coding system to codes in extended coding
	 * system.
	 *
	 * @param codes
	 *            A mapping from CUIs to codes in the reference coding
	 *            system.
	 * @return A mapping from CUIs to a mapping from codes in the reference
	 *         coding systems to source concepts in the extended coding
	 *         system
	 * @throws CodeMapperException
	 */
	public Map<String, Map<String, List<SourceConcept>>> mapCodes(Map<String, List<SourceConcept>> codes) throws CodeMapperException;

	/** Create a mapping from codes in the extended mapping to CUIs that correspond to the codes 
	 * @throws CodeMapperException */
    public List<String> getCuisForCodes(List<String> codes) throws CodeMapperException;
}