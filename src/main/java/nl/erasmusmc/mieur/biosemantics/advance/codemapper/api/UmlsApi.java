package nl.erasmusmc.mieur.biosemantics.advance.codemapper.api;

import java.util.List;

import nl.erasmusmc.mieur.biosemantics.advance.codemapper.CodingSystem;
import nl.erasmusmc.mieur.biosemantics.advance.codemapper.UmlsConcept;

public interface UmlsApi {

	public abstract List<UmlsConcept> getConcepts(List<String> cuis, List<String> vocabularies)
			throws CodeMapperException;

	public abstract List<CodingSystem> getCodingSystems() throws CodeMapperException;

}