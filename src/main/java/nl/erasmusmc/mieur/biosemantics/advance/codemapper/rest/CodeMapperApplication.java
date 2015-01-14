package nl.erasmusmc.mieur.biosemantics.advance.codemapper.rest;

import java.util.Arrays;
import java.util.List;

import javax.servlet.ServletContext;
import javax.ws.rs.ApplicationPath;
import javax.ws.rs.core.Context;

import org.glassfish.jersey.server.ResourceConfig;

import nl.erasmusmc.mieur.biosemantics.advance.codemapper.api.UmlsApi;
import nl.erasmusmc.mieur.biosemantics.advance.codemapper.api.UmlsApiUtf;

@ApplicationPath("resource")
public class CodeMapperApplication extends ResourceConfig {

	private static UmlsApi umlsApi = null;

    public static UmlsApi getUmlsApi() {
    	return umlsApi;
    }

    public CodeMapperApplication(@Context ServletContext context) {
//    	packages("nl.erasmusmc.mieur.biosemantics.advance.codemapper.rest");
    	String serviceName = context.getInitParameter("service-name");
		String version = context.getInitParameter("version");
		String username = context.getInitParameter("username");
		String password = context.getInitParameter("password");
		List<String> availableVocabularies =
				Arrays.asList(context.getInitParameter("available-vocabularies").split(",\\s*"));
		List<String> vocabulariesWithDefinition =
				Arrays.asList(context.getInitParameter("vocabularies-with-definition").split(",\\s*"));
		umlsApi = new UmlsApiUtf(serviceName, version, username, password, availableVocabularies, vocabulariesWithDefinition);
    }
}