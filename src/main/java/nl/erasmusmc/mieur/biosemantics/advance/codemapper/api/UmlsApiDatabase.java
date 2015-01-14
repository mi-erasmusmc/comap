package nl.erasmusmc.mieur.biosemantics.advance.codemapper.api;

import java.util.List;

import nl.erasmusmc.mieur.biosemantics.advance.codemapper.CodingSystem;
import nl.erasmusmc.mieur.biosemantics.advance.codemapper.UmlsConcept;

/**
 * Database based implementation of the UMLS API used for the code mapper.
 *
 * @author benus
 *
 */
public class UmlsApiDatabase implements UmlsApi {

	@Override
	public List<CodingSystem> getCodingSystems() throws CodeMapperException {
		// TODO Auto-generated method stub
		return null;
	}

	@Override
	public List<UmlsConcept> getUmlsConcepts(List<String> cuis, List<String> vocabularies, List<String> expand)
			throws CodeMapperException {
		// TODO Auto-generated method stub
		return null;
	}

}
