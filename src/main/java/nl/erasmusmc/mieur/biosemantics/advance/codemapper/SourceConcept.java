package nl.erasmusmc.mieur.biosemantics.advance.codemapper;

import java.util.ArrayList;
import java.util.List;

import javax.xml.bind.annotation.XmlRootElement;

@XmlRootElement
public class SourceConcept {
    private String cui = null;
    private String vocabulary = null;
    private String id = null;
    private String preferredTerm = null;
    private List<String> terms = new ArrayList<String>();

    public SourceConcept() {
    }

    public SourceConcept(String cui, String vocabulary, String id, String preferredTerm) {
        this.cui = cui;
        this.vocabulary = vocabulary;
        this.id = id;
        this.preferredTerm = preferredTerm;
    }

    public SourceConcept(String cui, String vocabulary, String id) {
        this.cui = cui;
        this.vocabulary = vocabulary;
        this.id = id;
    }

    public String getVocabulary() {
        return vocabulary;
    }

    public void setVocabulary(String source) {
        this.vocabulary = source;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getCui() {
        return cui;
    }

    public void setCui(String cui) {
        this.cui = cui;
    }

    public String getPreferredTerm() {
        return preferredTerm;
    }

    public void setPreferredTerm(String preferredTerm) {
        this.preferredTerm = preferredTerm;
    }

    public List<String> getTerms() {
        return terms;
    }

    public void setTerms(List<String> terms) {
        this.terms = terms;
    }
}