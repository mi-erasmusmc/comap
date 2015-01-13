package nl.erasmusmc.mieur.biosemantics.advance.codemapper.rest;

import java.util.Arrays;
import java.util.List;

import javax.servlet.ServletContext;
import javax.ws.rs.ApplicationPath;
import javax.ws.rs.core.Context;

import org.glassfish.jersey.server.ResourceConfig;

import nl.erasmusmc.mieur.biosemantics.advance.codemapper.UmlsApi;

@ApplicationPath("resource")
public class CodeMapperApplication extends ResourceConfig {

    public CodeMapperApplication(@Context ServletContext context) {
//    	packages("nl.erasmusmc.mieur.biosemantics.advance.codemapper.rest");
    	String serviceName = context.getInitParameter("service-name");
		String version = context.getInitParameter("version");
		String username = context.getInitParameter("username");
		String password = context.getInitParameter("password");
		List<String> availableVocabularies =
				Arrays.asList(context.getInitParameter("available-vocabularies").split(",\\s*"));
		UmlsApi.getInstance().init(serviceName, version, username, password, availableVocabularies);
    }
}