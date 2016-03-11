package nl.erasmusmc.mieur.biosemantics.advance.codemapper.rest;

import java.io.IOException;
import java.sql.SQLException;
import java.util.Arrays;
import java.util.List;
import java.util.Properties;

import javax.servlet.ServletContext;
import javax.servlet.http.HttpSession;
import javax.sql.DataSource;
import javax.ws.rs.ApplicationPath;
import javax.ws.rs.core.Context;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.glassfish.hk2.utilities.binding.AbstractBinder;
import org.glassfish.jersey.server.ResourceConfig;

import com.mchange.v2.c3p0.DataSources;

import nl.erasmusmc.mieur.biosemantics.advance.codemapper.UmlsApi;
import nl.erasmusmc.mieur.biosemantics.advance.codemapper.authentification.AuthentificationApi;
import nl.erasmusmc.mieur.biosemantics.advance.codemapper.authentification.User;
import nl.erasmusmc.mieur.biosemantics.advance.codemapper.persistency.PersistencyApi;
import nl.erasmusmc.mieur.biosemantics.advance.codemapper.service.DownloadApi;
import nl.erasmusmc.mieur.biosemantics.advance.codemapper.service.DownloadResource;
import nl.erasmusmc.mieur.biosemantics.advance.codemapper.umls_ext.Icd10AnyCodingSystem;
import nl.erasmusmc.mieur.biosemantics.advance.codemapper.umls_ext.Rcd2CodingSystem;

@ApplicationPath("rest")
public class CodeMapperApplication extends ResourceConfig {

	private static final String CODE_MAPPER_PROPERTIES = "/code-mapper.properties";
	
    private static Logger logger = LogManager.getLogger(CodeMapperApplication.class);

	private static String peregrineResourceUrl;
	private static UmlsApi umlsApi;
	private static PersistencyApi persistencyApi;
	private static AuthentificationApi authentificationApi;
	private static DownloadApi downloadApi;

	private DataSource getConnectionPool(String prefix, Properties properties) throws SQLException {
        String uri = properties.getProperty(prefix + "-uri");
        String username = properties.getProperty(prefix + "-username");
        String password = properties.getProperty(prefix + "-password");
        logger.info("Get connection pool " + prefix);
        return DataSources.unpooledDataSource(uri, username, password);
	}

	public CodeMapperApplication(@Context ServletContext context) throws IOException {
		
		try {
			Class.forName("com.mysql.jdbc.Driver");
		} catch (LinkageError | ClassNotFoundException e) {
			logger.error("Can't load MYSQL JDBC driver");
		}

		packages(getClass().getPackage().getName(), DownloadResource.class.getPackage().getName());
		register(new AbstractBinder() {
            @Override
            protected void configure() {
                bindFactory(HttpSessionFactory.class).to(HttpSession.class);
                bindFactory(UserFactory.class).to(User.class);
            }
        });

		try {
			Properties properties = new Properties();
			properties.load(getClass().getResourceAsStream(CODE_MAPPER_PROPERTIES));

			List<String> availableCodingSystems = Arrays.asList(
					properties.getProperty("available-coding-systems").split(",\\s*"));

			List<String> codingSystemsWithDefinition = Arrays.asList(
					properties.getProperty("coding-systems-with-definition").split(",\\s*"));

			peregrineResourceUrl = properties.getProperty("peregrine-resource-url");

			DataSource umlsConnectionPool = getConnectionPool("umls-db", properties);
			umlsApi = new UmlsApi(umlsConnectionPool, availableCodingSystems, codingSystemsWithDefinition);

            DataSource umlsExtConnectionPool = getConnectionPool("umls-ext-db", properties);
            umlsApi.registerCodingSystemsExtension(new Rcd2CodingSystem(umlsExtConnectionPool));
            umlsApi.registerCodingSystemsExtension(new Icd10AnyCodingSystem(umlsConnectionPool));

            DataSource codeMapperConnectionPool = getConnectionPool("code-mapper-db", properties);
            persistencyApi = new PersistencyApi(codeMapperConnectionPool);
            authentificationApi = new AuthentificationApi(codeMapperConnectionPool);
            downloadApi = new DownloadApi();

		} catch (SQLException e) {
		    logger.error("Cannot create pooled data source");
            e.printStackTrace();
        }
	}

	public static String getPeregrineResourceUrl() {
		return peregrineResourceUrl;
	}

	public static UmlsApi getUmlsApi() {
		return umlsApi;
	}
	
	public static PersistencyApi getPersistencyApi() {
		return persistencyApi;
	}
	
	public static AuthentificationApi getAuthentificationApi() {
		return authentificationApi;
	}

	public static DownloadApi getDownloadApi() {
		return downloadApi;
	}
}
