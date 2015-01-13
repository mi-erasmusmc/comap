package nl.erasmusmc.mieur.biosemantics.advance.codemapper;

import javax.xml.bind.annotation.XmlRootElement;

@XmlRootElement
public class CodingSystem {
	private String abbreviation = null;
	private String name = null;
	private String family = null;

	public CodingSystem() {
	}

	public CodingSystem(String abbrevation, String name, String family) {
		this.abbreviation = abbrevation;
		this.name = name;
		this.family = family;
	}

	public String getAbbreviation() {
		return abbreviation;
	}

	public void setAbbreviation(String abbreviation) {
		this.abbreviation = abbreviation;
	}

	public String getName() {
		return name;
	}

	public void setName(String name) {
		this.name = name;
	}

	public String getFamily() {
		return family;
	}

	public void setFamily(String family) {
		this.family = family;
	}
}