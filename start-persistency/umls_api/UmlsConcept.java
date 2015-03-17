package nl.erasmusmc.mieur.biosemantics.advance.codemapper.umls_api;

import java.util.LinkedList;
import java.util.List;

import javax.xml.bind.annotation.XmlRootElement;

@XmlRootElement
public class UmlsConcept {
    private String cui = null;
    private String preferredName = null;
    private String definition = null;
    private List<SourceConcept> sourceConcepts = new LinkedList<>();;
    private List<String> semanticTypes = new LinkedList<>();

    public UmlsConcept() {
    }

    public UmlsConcept(String cui, String preferredName, String definition, List<String> semanticTypes,
            List<SourceConcept> sourceConcepts) {
        this.cui = cui;
        this.preferredName = preferredName;
        this.definition = definition;
        this.semanticTypes = semanticTypes;
        this.sourceConcepts = sourceConcepts;
    }

	public UmlsConcept(String cui, String preferredName) {
        this.cui = cui;
        this.preferredName = preferredName;
    }

    public String getCui() {
        return cui;
    }

    public void setCui(String cui) {
        this.cui = cui;
    }

    public String getPreferredName() {
        return preferredName;
    }

    public void setPreferredName(String preferredName) {
        this.preferredName = preferredName;
    }

    public String getDefinition() {
        return definition;
    }

    public void setDefinition(String definition) {
        this.definition = definition;
    }

    public List<String> getSemanticTypes() {
        return semanticTypes;
    }

    public void setSemanticTypes(List<String> semanticTypes) {
        this.semanticTypes = semanticTypes;
    }

    public List<SourceConcept> getSourceConcepts() {
        return sourceConcepts;
    }

    public void setSourceConcepts(List<SourceConcept> sourceConcepts) {
        this.sourceConcepts = sourceConcepts;
    }
}