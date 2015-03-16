package nl.erasmusmc.mieur.biosemantics.advance.codemapper.rest;

import java.io.IOException;
import java.util.Arrays;
import java.util.List;
import java.util.Properties;

import javax.servlet.ServletContext;
import javax.servlet.http.HttpSession;
import javax.ws.rs.ApplicationPath;
import javax.ws.rs.core.Context;

import org.apache.log4j.Logger;
import org.glassfish.hk2.utilities.binding.AbstractBinder;
import org.glassfish.jersey.server.ResourceConfig;

import nl.erasmusmc.mieur.biosemantics.advance.codemapper.UmlsApi;
import nl.erasmusmc.mieur.biosemantics.advance.codemapper.authentification.AuthentificationApi;
import nl.erasmusmc.mieur.biosemantics.advance.codemapper.authentification.User;
import nl.erasmusmc.mieur.biosemantics.advance.codemapper.persistency.DatabasePersistencyApi;
import nl.erasmusmc.mieur.biosemantics.advance.codemapper.persistency.PersistencyApi;

@ApplicationPath("rest")
public class CodeMapperApplication extends ResourceConfig {

	private static final String CODE_MAPPER_PROPERTIES = "/WEB-INF/code-mapper.properties";

	private static String peregrineResourceUrl;
	private static UmlsApi umlsApi;
	private static PersistencyApi persistencyApi;
	private static AuthentificationApi authentificationApi;

	public static UmlsApi getUmlsApi() {
		return umlsApi;
	}
	public static PersistencyApi getPersistencyApi() {
		return persistencyApi;
	}
	public static AuthentificationApi getAuthentificationApi() {
		return authentificationApi;
	}

	private static Logger logger = Logger.getLogger("AdvanceCodeMapper");

	public CodeMapperApplication(@Context ServletContext context) throws IOException {
		try {
			Class.forName("com.mysql.jdbc.Driver");
			packages("nl.erasmusmc.mieur.biosemantics.advance.codemapper.rest");
			register(CodeMapperResource.class);
			register(PersistencyResource.class);
			register(AuthentificationResource.class);
			register(new AbstractBinder() {
	            @Override
	            protected void configure() {
	                bindFactory(HttpSessionFactory.class).to(HttpSession.class);
	                bindFactory(UserFactory.class).to(User.class);
	            }
	        });

			Properties properties = new Properties();
			properties.load(context.getResourceAsStream(CODE_MAPPER_PROPERTIES));

			List<String> availableVocabularies = Arrays.asList(
					properties.getProperty("available-vocabularies").split(",\\s*"));

			List<String> vocabulariesWithDefinition = Arrays.asList(
					properties.getProperty("vocabularies-with-definition").split(",\\s*"));

			peregrineResourceUrl = properties.getProperty("peregrine-resource-url");

			String umlsDatabaseUri = properties.getProperty("umls-db-uri");
			String umlsDatabaseUsername = properties.getProperty("umls-db-username");
			String umlsDatabasePassword = properties.getProperty("umls-db-password");
			Properties umlsConnectionProperties = new Properties();
			umlsConnectionProperties.setProperty("user", umlsDatabaseUsername);
			umlsConnectionProperties.setProperty("password", umlsDatabasePassword);
			umlsApi = new UmlsApi(umlsDatabaseUri, umlsConnectionProperties, availableVocabularies, vocabulariesWithDefinition);

			String codeMapperDatabaseUri = properties.getProperty("code-mapper-db-uri");
			String codeMapperConnectionUsername = properties.getProperty("code-mapper-db-username");
			String codeMapperConnectionPassword = properties.getProperty("code-mapper-db-password");
			Properties codeMapperConnectionProperties = new Properties();
			codeMapperConnectionProperties.setProperty("user", codeMapperConnectionUsername);
			codeMapperConnectionProperties.setProperty("password", codeMapperConnectionPassword);

			persistencyApi = new DatabasePersistencyApi(codeMapperDatabaseUri, codeMapperConnectionProperties);
			authentificationApi = new AuthentificationApi(codeMapperDatabaseUri, codeMapperConnectionProperties);
		} catch (LinkageError | ClassNotFoundException e) {
			logger.error("Couldn't load MYSQL JDBC driver");
		}
	}

	public static String getPeregrineResourceUrl() {
		return peregrineResourceUrl;
	}
}
