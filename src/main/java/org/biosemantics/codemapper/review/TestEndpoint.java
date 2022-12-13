package org.biosemantics.codemapper.review;

import javax.websocket.EndpointConfig;
import javax.websocket.OnOpen;
import javax.websocket.Session;
import javax.websocket.server.PathParam;
import javax.websocket.server.ServerEndpoint;

import org.biosemantics.codemapper.authentification.User;

@ServerEndpoint(value = "/test/{project}/{caseDefinition}",
configurator = GetHttpSessionConfigurator.class
)
public class TestEndpoint {
	@OnOpen
	public void onOpen(Session session, EndpointConfig config, @PathParam("project") String project, @PathParam("caseDefinition") String caseDefinition) {

        User user = (User) config.getUserProperties().get("user");
		System.out.println("Test: " + user + " " + project + " " + caseDefinition + " " + user);
	}
}
