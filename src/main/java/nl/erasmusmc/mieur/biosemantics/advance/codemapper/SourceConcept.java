package nl.erasmusmc.mieur.biosemantics.advance.codemapper;

import javax.xml.bind.annotation.XmlRootElement;

@XmlRootElement
public class SourceConcept {
    private String cui = null;
    private String codingSystem = null;
    private String id = null;
    private String preferredTerm = null;

    public SourceConcept() {
    }

    public SourceConcept(String cui, String codingSystem, String id, String preferredTerm) {
        this.cui = cui;
        this.codingSystem = codingSystem;
        this.id = id;
        this.preferredTerm = preferredTerm;
    }

    public SourceConcept(String cui, String codingSystem, String id) {
        this.cui = cui;
        this.codingSystem = codingSystem;
        this.id = id;
    }

    public String getCodingSystem() {
        return codingSystem;
    }

    public void setCodingSystem(String codingSystem) {
        this.codingSystem = codingSystem;
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
}