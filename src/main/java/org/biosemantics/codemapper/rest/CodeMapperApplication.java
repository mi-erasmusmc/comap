/*******************************************************************************
 * Copyright 2017 Erasmus Medical Center, Department of Medical Informatics.
 *
 * This program shall be referenced as “Codemapper”.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 ******************************************************************************/
package org.biosemantics.codemapper.rest;

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

import org.apache.logging.log4j.Level;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.apache.logging.log4j.core.config.Configurator;
import org.apache.logging.log4j.core.config.builder.api.ConfigurationBuilder;
import org.apache.logging.log4j.core.config.builder.api.ConfigurationBuilderFactory;
import org.apache.logging.log4j.core.config.builder.impl.BuiltConfiguration;
import org.biosemantics.codemapper.UmlsApi;
import org.biosemantics.codemapper.UtsApi;
import org.biosemantics.codemapper.authentification.AuthentificationApi;
import org.biosemantics.codemapper.authentification.User;
import org.biosemantics.codemapper.descendants.DescendersApi;
import org.biosemantics.codemapper.descendants.DescendersApi.GeneralDescender;
import org.biosemantics.codemapper.descendants.SnowstormDescender;
import org.biosemantics.codemapper.descendants.UmlsDescender;
import org.biosemantics.codemapper.persistency.PersistencyApi;
import org.biosemantics.codemapper.service.DownloadResource;
import org.biosemantics.codemapper.service.WriteXlsApi;
import org.biosemantics.codemapper.umls_ext.Icd10AnyCodingSystem;
import org.biosemantics.codemapper.umls_ext.Rcd2CodingSystem;
import org.glassfish.hk2.utilities.binding.AbstractBinder;
import org.glassfish.jersey.server.ResourceConfig;

import com.mchange.v2.c3p0.DataSources;

@ApplicationPath("rest")
public class CodeMapperApplication extends ResourceConfig {


	private static Logger logger = LogManager.getLogger(CodeMapperApplication.class);

	private static final String CODE_MAPPER_PROPERTIES = "/code-mapper.properties";

	// Property names
	private static final String AVAILABLE_CODING_SYSTEMS = "available-coding-systems";
	private static final String CODE_MAPPER_DB = "code-mapper-db";
	private static final String CODEMAPPER_UMLS_VERSION = "codemapper-umls-version";
	private static final String CODING_SYSTEMS_WITH_DEFINITION = "coding-systems-with-definition";
	private static final String DB_PASSWORD_SUFFIX = "-password";
	private static final String DB_URI_SUFFIX = "-uri";
	private static final String DB_USERNAME_SUFFIX = "-username";
	private static final String PEREGRINE_RESOURCE_URL = "peregrine-resource-url";
	private static final String SNOWSTORM_BASE_URI = "snowstorm-base-uri";
	private static final String SNOWSTORM_BRANCH = "snowstorm-branch";
	private static final String UMLS_DB = "umls-db";
	private static final String UMLS_EXT_DB_CTV3RCT_TABLE = "umls-ext-db-ctv3rct-table";
	private static final String UMLS_EXT_DB = "umls-ext-db";
	private static final String UTS_API_KEY = "uts-api-key";

	private static Properties properties;
	private static String peregrineResourceUrl;
	private static String umlsVersion;
	private static UmlsApi umlsApi;
	private static PersistencyApi persistencyApi;
	private static AuthentificationApi authentificationApi;
	private static WriteXlsApi writeXlsApi;
	private static UtsApi utsApi;
	private static DescendersApi descendersApi;

	static {
		properties = new Properties();
	    try {
	    	properties.load(CodeMapperApplication.class.getResourceAsStream(CODE_MAPPER_PROPERTIES));
	    } catch (IOException e) {
	    	logger.error("Cannot load " + CODE_MAPPER_PROPERTIES);
	    	e.printStackTrace();
	    }
	}

	public CodeMapperApplication(@Context ServletContext context) {
		initialize();
		
		// Try loading the database driver. Necessary, otherwise database connections
		// will fail with exception java.sql.SQLException: No suitable driver
		try {
			Class.forName("org.postgresql.Driver");
		} catch (LinkageError | ClassNotFoundException e) {
			logger.error("Can't load MYSQL JDBC driver");
			e.printStackTrace();
			return;
		}

		packages(getClass().getPackage().getName(), DownloadResource.class.getPackage().getName());
		register(new AbstractBinder() {
			@Override
			protected void configure() {
				bindFactory(HttpSessionFactory.class).to(HttpSession.class);
				bindFactory(UserFactory.class).to(User.class);
			}
		});
	}

	public static void initialize() {
		DataSource umlsConnectionPool,  umlsExtConnectionPool, codeMapperConnectionPool;
		try {
			umlsConnectionPool = getConnectionPool(UMLS_DB);
            umlsExtConnectionPool = getConnectionPool(UMLS_EXT_DB);
            codeMapperConnectionPool = getConnectionPool(CODE_MAPPER_DB);
		} catch (SQLException e) {
		    logger.error("Cannot create pooled data source");
            e.printStackTrace();
            return;
        }

		String availableCodingSystemsStr = properties.getProperty(AVAILABLE_CODING_SYSTEMS);
		List<String> availableCodingSystems = null;
		if (availableCodingSystemsStr != null)
			availableCodingSystems = Arrays.asList(availableCodingSystemsStr.split(",\\s*"));

		List<String> codingSystemsWithDefinition = Arrays
				.asList(properties.getProperty(CODING_SYSTEMS_WITH_DEFINITION).split(",\\s*"));

		peregrineResourceUrl = properties.getProperty(PEREGRINE_RESOURCE_URL);
		umlsVersion = properties.getProperty(CODEMAPPER_UMLS_VERSION);

		umlsApi = new UmlsApi(umlsConnectionPool, availableCodingSystems, codingSystemsWithDefinition);

		String ctv3rctTableName = properties.getProperty(UMLS_EXT_DB_CTV3RCT_TABLE);
		umlsApi.registerCodingSystemsExtension(new Rcd2CodingSystem(umlsExtConnectionPool, ctv3rctTableName));
		umlsApi.registerCodingSystemsExtension(new Icd10AnyCodingSystem(umlsConnectionPool));

		persistencyApi = new PersistencyApi(codeMapperConnectionPool);
		authentificationApi = new AuthentificationApi(codeMapperConnectionPool);
		writeXlsApi = new WriteXlsApi();

		String utsApiKey = properties.getProperty(UTS_API_KEY);
		utsApi = new UtsApi(utsApiKey);

		GeneralDescender umlsDescender = new UmlsDescender(umlsConnectionPool);
		descendersApi = new DescendersApi(umlsDescender);
		
		String snowstormBaseUri = properties.getProperty(SNOWSTORM_BASE_URI);
		String snowstormBranch = properties.getProperty(SNOWSTORM_BRANCH);
        if (snowstormBaseUri == null || snowstormBranch == null) {
        	logger.warn("Snowstorm not configured; disabled");
        } else {
            descendersApi.addSpecificDescender(
                    new SnowstormDescender("SNOMEDCT_US", snowstormBaseUri, snowstormBranch));
            descendersApi.addSpecificDescender(
                    new SnowstormDescender("SCTSPA", snowstormBaseUri, snowstormBranch));
        }
	}

	public static DataSource getConnectionPool(String prefix) throws SQLException {
        String uri = properties.getProperty(prefix + DB_URI_SUFFIX);
        String username = properties.getProperty(prefix + DB_USERNAME_SUFFIX);
        String password = properties.getProperty(prefix + DB_PASSWORD_SUFFIX);
        logger.info("Get connection pool " + prefix);
        return DataSources.unpooledDataSource(uri, username, password);
	}
	
	public static String getProp(String str) {
		return properties.getProperty(str);
	}

	public static String getPeregrineResourceUrl() {
		return peregrineResourceUrl;
	}

	public static String getUmlsVersion() {
		return umlsVersion;
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

	public static WriteXlsApi getWriteXlsApi() {
		return writeXlsApi;
	}

	public static UtsApi getUtsApi() {
	    return utsApi;
	}

	public static DescendersApi getDescendantsApi() {
	    return descendersApi;
	}

    public static void reconfigureLog4j2(Level level) {
        ConfigurationBuilder<BuiltConfiguration> builder = ConfigurationBuilderFactory
                .newConfigurationBuilder();
        builder.add(builder
                .newAppender("stdout", "Console")
                .add(builder.newLayout("PatternLayout")
                        .addAttribute("pattern", "%level: %logger{1} - %msg%n%throwable")));
        builder.add(builder.newRootLogger(level)
                .add(builder.newAppenderRef("stdout")));
        Configurator.reconfigure(builder.build());
    }
}
