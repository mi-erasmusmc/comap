package nl.erasmusmc.mieur.biosemantics.advance.codemapper.rest;

import java.util.Arrays;
import java.util.List;
import java.util.Properties;

import javax.servlet.ServletContext;
import javax.ws.rs.ApplicationPath;
import javax.ws.rs.core.Context;

import org.glassfish.jersey.server.ResourceConfig;

import nl.erasmusmc.mieur.biosemantics.advance.codemapper.api.UmlsApi;
import nl.erasmusmc.mieur.biosemantics.advance.codemapper.api.UmlsApiDatabase;
import nl.erasmusmc.mieur.biosemantics.advance.codemapper.api.UmlsApiUtf;

@ApplicationPath("resource")
public class CodeMapperApplication extends ResourceConfig {

	private static final boolean UTF_NOT_DATABASE = false;
	private static UmlsApi api = null;

	public static UmlsApi getApi() {
		return api;
	}

	public CodeMapperApplication(@Context ServletContext context) {
	    packages("nl.erasmusmc.mieur.biosemantics.advance.codemapper.rest");
		List<String> availableVocabularies = Arrays.asList(context.getInitParameter("available-vocabularies")
				.split(",\\s*"));
		List<String> vocabulariesWithDefinition = Arrays.asList(context.getInitParameter(
				"vocabularies-with-definition").split(",\\s*"));
		System.out.println("VOCS: " + availableVocabularies.size());
		if (UTF_NOT_DATABASE) {
			String serviceName = context.getInitParameter("service-name");
			String version = context.getInitParameter("version");
			String username = context.getInitParameter("username");
			String password = context.getInitParameter("password");
			api = new UmlsApiUtf(serviceName, version, username, password, availableVocabularies,
					vocabulariesWithDefinition);
		} else {
			String uri = "jdbc:mysql://mi-bios1/umls2014aa";
			Properties properties = new Properties();
			properties.setProperty("user", "root");
			properties.setProperty("password", "");
			api = new UmlsApiDatabase(uri, properties, availableVocabularies, vocabulariesWithDefinition);
		}
	}
}