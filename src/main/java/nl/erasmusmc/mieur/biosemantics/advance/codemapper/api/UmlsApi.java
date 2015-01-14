package nl.erasmusmc.mieur.biosemantics.advance.codemapper.api;

import java.util.List;

import nl.erasmusmc.mieur.biosemantics.advance.codemapper.CodingSystem;
import nl.erasmusmc.mieur.biosemantics.advance.codemapper.UmlsConcept;

public interface UmlsApi {

	public abstract List<UmlsConcept> getUmlsConcepts(List<String> cuis, List<String> vocabularies, List<String> expand)
			throws CodeMapperException;

	public abstract List<CodingSystem> getCodingSystems() throws CodeMapperException;

}