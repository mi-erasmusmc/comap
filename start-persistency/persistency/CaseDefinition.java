package nl.erasmusmc.mieur.biosemantics.advance.codemapper.persistency;

import javax.json.JsonObject;

public class CaseDefinition {

	private JsonObject config;

	public CaseDefinition(JsonObject config) {
		super();
		this.config = config;
	}

	public JsonObject getConfig() {
		return config;
	}

	public void setConfig(JsonObject config) {
		this.config = config;
	}
}
