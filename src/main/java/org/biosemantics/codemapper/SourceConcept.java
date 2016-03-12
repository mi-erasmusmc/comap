package org.biosemantics.codemapper;

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

    @Override
    public String toString() {
    	return String.format("%s@%s", id, codingSystem);
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

    @Override
	public int hashCode() {
		final int prime = 31;
		int result = 1;
		result = prime * result + ((codingSystem == null) ? 0 : codingSystem.hashCode());
		result = prime * result + ((cui == null) ? 0 : cui.hashCode());
		result = prime * result + ((id == null) ? 0 : id.hashCode());
		result = prime * result + ((preferredTerm == null) ? 0 : preferredTerm.hashCode());
		return result;
	}

	@Override
	public boolean equals(Object obj) {
		if (this == obj)
			return true;
		if (obj == null)
			return false;
		if (getClass() != obj.getClass())
			return false;
		SourceConcept other = (SourceConcept) obj;
		if (codingSystem == null) {
			if (other.codingSystem != null)
				return false;
		} else if (!codingSystem.equals(other.codingSystem))
			return false;
		if (cui == null) {
			if (other.cui != null)
				return false;
		} else if (!cui.equals(other.cui))
			return false;
		if (id == null) {
			if (other.id != null)
				return false;
		} else if (!id.equals(other.id))
			return false;
		if (preferredTerm == null) {
			if (other.preferredTerm != null)
				return false;
		} else if (!preferredTerm.equals(other.preferredTerm))
			return false;
		return true;
	}
}