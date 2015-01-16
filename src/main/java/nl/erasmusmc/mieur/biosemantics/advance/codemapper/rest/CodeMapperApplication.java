package nl.erasmusmc.mieur.biosemantics.advance.codemapper.rest;

import java.util.Arrays;
import java.util.List;
import java.util.Properties;

import javax.servlet.ServletContext;
import javax.ws.rs.ApplicationPath;
import javax.ws.rs.core.Context;

import org.apache.log4j.Logger;
import org.glassfish.jersey.server.ResourceConfig;

import nl.erasmusmc.mieur.biosemantics.advance.codemapper.api.UmlsApi;
import nl.erasmusmc.mieur.biosemantics.advance.codemapper.api.UmlsApiDatabase;
import nl.erasmusmc.mieur.biosemantics.advance.codemapper.api.UmlsApiUtf;

@ApplicationPath("resource")
public class CodeMapperApplication extends ResourceConfig {

	private static final boolean UTF_NOT_DATABASE = false;
	private static UmlsApi api = null;
	private static String peregrineResourceUrl = null;

	public static UmlsApi getApi() {
		return api;
	}

	private static Logger logger = Logger.getLogger("AdvanceCodeMapper");

	public CodeMapperApplication(@Context ServletContext context) {
	    packages("nl.erasmusmc.mieur.biosemantics.advance.codemapper.rest");
        register(CodeMapperResource.class);

		List<String> availableVocabularies = Arrays.asList(context.getInitParameter("available-vocabularies")
				.split(",\\s*"));
		List<String> vocabulariesWithDefinition = Arrays.asList(context.getInitParameter(
				"vocabularies-with-definition").split(",\\s*"));
		System.out.println("VOCS: " + availableVocabularies.size());

		peregrineResourceUrl = context.getInitParameter("peregrine-resource-url");

		if (UTF_NOT_DATABASE) {
			String serviceName = context.getInitParameter("utf-service-name");
			String version = context.getInitParameter("utf-version");
			String username = context.getInitParameter("utf-username");
			String password = context.getInitParameter("utf-password");
			api = new UmlsApiUtf(serviceName, version, username, password, availableVocabularies,
					vocabulariesWithDefinition);
		} else {
            try {
	            Class.forName("com.mysql.jdbc.Driver");
	            String uri = context.getInitParameter("umls-db-uri");
	            String username = context.getInitParameter("umls-db-username");
	            String password = context.getInitParameter("umls-db-password");
	            Properties connectionProperties = new Properties();
	            connectionProperties.setProperty("user", username);
	            connectionProperties.setProperty("password", password);
	            api = new UmlsApiDatabase(uri, connectionProperties, availableVocabularies, vocabulariesWithDefinition);
            } catch (Exception e) {
            	logger.error("Couldn't load MYSQL JDBC driver");
            }
		}
	}

	public static String getPeregrineResourceUrl() {
		return peregrineResourceUrl;
	}
}
