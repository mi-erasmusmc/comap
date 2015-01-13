package nl.erasmusmc.mieur.biosemantics.advance.codemapper;

import javax.xml.bind.annotation.XmlRootElement;

@XmlRootElement
public class SourceTerm {
	private String source = null;
	private String term = null;

	public SourceTerm() {
	}

	public SourceTerm(String source, String term) {
		this.source = source;
		this.term = term;
	}

	public String getSource() {
		return source;
	}

	public void setSource(String source) {
		this.source = source;
	}

	public String getTerm() {
		return term;
	}

	public void setTerm(String term) {
		this.term = term;
	}
}