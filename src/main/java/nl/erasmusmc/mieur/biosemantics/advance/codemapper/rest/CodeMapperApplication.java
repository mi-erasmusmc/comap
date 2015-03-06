package nl.erasmusmc.mieur.biosemantics.advance.codemapper.rest;

import java.io.IOException;
import java.nio.file.Paths;
import java.util.Arrays;
import java.util.List;
import java.util.Properties;

import javax.servlet.ServletContext;
import javax.ws.rs.ApplicationPath;
import javax.ws.rs.core.Context;

import org.apache.log4j.Logger;
import org.glassfish.jersey.server.ResourceConfig;

import nl.erasmusmc.mieur.biosemantics.advance.codemapper.UmlsApi;
import nl.erasmusmc.mieur.biosemantics.advance.codemapper.persistency.PersistencyApi;

@ApplicationPath("resource")
public class CodeMapperApplication extends ResourceConfig {

	private static final String CODE_MAPPER_PROPERTIES = "/WEB-INF/code-mapper.properties";

	private static String peregrineResourceUrl = null;
	private static UmlsApi umlsApi = null;
	private static PersistencyApi persistencyApi = null;


	public static UmlsApi getUmlsApi() {
		return umlsApi;
	}
	public static PersistencyApi getPersistencyApi() {
		return persistencyApi;
	}

	private static Logger logger = Logger.getLogger("AdvanceCodeMapper");

	public CodeMapperApplication(@Context ServletContext context) throws IOException {
		try {
			Class.forName("com.mysql.jdbc.Driver");
			packages("nl.erasmusmc.mieur.biosemantics.advance.codemapper.rest");
			register(CodeMapperResource.class);
			register(PersistencyResource.class);

			Properties properties = new Properties();
			properties.load(context.getResourceAsStream(CODE_MAPPER_PROPERTIES));

			List<String> availableVocabularies = Arrays.asList(
					properties.getProperty("available-vocabularies").split(",\\s*"));

			List<String> vocabulariesWithDefinition = Arrays.asList(
					properties.getProperty("vocabularies-with-definition").split(",\\s*"));

			peregrineResourceUrl = properties.getProperty("peregrine-resource-url");

			String uri = properties.getProperty("umls-db-uri");
			String username = properties.getProperty("umls-db-username");
			String password = properties.getProperty("umls-db-password");
			Properties connectionProperties = new Properties();
			connectionProperties.setProperty("user", username);
			connectionProperties.setProperty("password", password);
			umlsApi = new UmlsApi(uri, connectionProperties, availableVocabularies, vocabulariesWithDefinition);

			String persistencyDirectory = properties.getProperty("persistency-directory");
			persistencyApi = new PersistencyApi(Paths.get(persistencyDirectory));
		} catch (LinkageError | ClassNotFoundException e) {
			logger.error("Couldn't load MYSQL JDBC driver");
		}
	}

	public static String getPeregrineResourceUrl() {
		return peregrineResourceUrl;
	}
}
