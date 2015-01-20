package nl.erasmusmc.mieur.biosemantics.advance.codemapper.rest;

import java.io.IOException;
import java.util.Arrays;
import java.util.Enumeration;
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

	private static final String CODE_MAPPER_PROPERTIES = "/WEB-INF/code-mapper.properties";
	private static final boolean UTF_NOT_DATABASE = false;
	private static UmlsApi api = null;
	private static String peregrineResourceUrl = null;

	public static UmlsApi getApi() {
		return api;
	}

	private static Logger logger = Logger.getLogger("AdvanceCodeMapper");

	public CodeMapperApplication(@Context ServletContext context) throws IOException {
		packages("nl.erasmusmc.mieur.biosemantics.advance.codemapper.rest");
		register(CodeMapperResource.class);

		Properties properties = new Properties();
		properties.load(context.getResourceAsStream(CODE_MAPPER_PROPERTIES));

		List<String> availableVocabularies = Arrays.asList(
			properties.getProperty("available-vocabularies").split(",\\s*"));
		List<String> vocabulariesWithDefinition = Arrays.asList(
			properties.getProperty("vocabularies-with-definition").split(",\\s*"));

		peregrineResourceUrl = properties.getProperty("peregrine-resource-url");

		if (UTF_NOT_DATABASE) {
			String serviceName = properties.getProperty("utf-service-name");
			String version = properties.getProperty("utf-version");
			String username = properties.getProperty("utf-username");
			String password = properties.getProperty("utf-password");
			api = new UmlsApiUtf(serviceName, version, username, password, availableVocabularies,
					vocabulariesWithDefinition);
		} else {
			try {
				Class.forName("com.mysql.jdbc.Driver");
				String uri = properties.getProperty("umls-db-uri");
				String username = properties.getProperty("umls-db-username");
				String password = properties.getProperty("umls-db-password");
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
