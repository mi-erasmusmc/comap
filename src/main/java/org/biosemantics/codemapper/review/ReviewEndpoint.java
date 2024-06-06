package org.biosemantics.codemapper.review;

import com.fasterxml.jackson.annotation.JsonAutoDetect.Visibility;
import com.fasterxml.jackson.annotation.PropertyAccessor;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import javax.websocket.EncodeException;
import javax.websocket.EndpointConfig;
import javax.websocket.OnClose;
import javax.websocket.OnError;
import javax.websocket.OnMessage;
import javax.websocket.OnOpen;
import javax.websocket.Session;
import javax.websocket.server.PathParam;
import javax.websocket.server.ServerEndpoint;
import org.biosemantics.codemapper.CodeMapperException;
import org.biosemantics.codemapper.authentification.User;
import org.biosemantics.codemapper.rest.CodeMapperApplication;
import org.biosemantics.codemapper.review.ReviewApi.AllTopics;

/*
 * CLIENT                                    SERVER
 *    <--  CurrentThreads(threads)           <-- (on init)
 *    -->  SendMessage(content, cui, thread) -->
 *    <--  NewMessage(content, cui, thread)  <-- (after SendMessage)
 */

@ServerEndpoint(
    value = "/review/{project}/{caseDefinition}",
    encoders = MessageEncoder.class,
    decoders = MessageDecoder.class,
    configurator = GetHttpSessionConfigurator.class)
public class ReviewEndpoint {

  //	static PolymorphicTypeValidator ptv = BasicPolymorphicTypeValidator.builder()
  //			.allowIfSubType(ClientMessage.class)
  //			.allowIfSubType(ServerMessage.class)
  //			.build();

  // private (non-static) Set<ReviewEndpoint> endpoints??
  private static Map<String, Map<String, Set<ReviewEndpoint>>> endpoints = new HashMap<>();

  private Session session;
  User user;
  String project;
  String caseDefinition;

  @OnOpen
  public void onOpen(
      Session session,
      EndpointConfig config,
      @PathParam("project") String project,
      @PathParam("caseDefinition") String caseDefinition)
      throws IOException {

    this.user = (User) config.getUserProperties().get("user");
    if (this.user == null) {
      throw new IOException("user not logged in");
    }
    System.out.println("ReviewEndpoint user: " + user + " " + project + " " + caseDefinition);

    this.session = session;
    this.project = project;
    this.caseDefinition = caseDefinition;
    endpoints
        .getOrDefault(project, new HashMap<>())
        .getOrDefault(caseDefinition, new HashSet<>())
        .add(this);

    try {
      AllTopics allTopics =
          CodeMapperApplication.getReviewApi()
              .getAll(project, caseDefinition, this.user.getUsername());
      ObjectMapper mapper = new ObjectMapper();
      mapper.setVisibility(PropertyAccessor.FIELD, Visibility.ANY);
      this.session.getBasicRemote().sendObject(new ServerMessage.CurrentThreads(allTopics));
    } catch (IOException | EncodeException | CodeMapperException e) {
      e.printStackTrace();
    }
  }

  static void broadcast(ServerMessage message) throws IOException {
    endpoints.forEach(
        (project, forProject) -> {
          forProject.forEach(
              (caseDefinition, forCasedef) -> {
                forCasedef.forEach(
                    endpoint -> {
                      try {
                        endpoint.session.getBasicRemote().sendObject(message);
                      } catch (IOException | EncodeException e) {
                        e.printStackTrace();
                      }
                    });
              });
        });
  }

  @OnMessage
  public void onMessage(Session session, ClientMessage message) throws IOException {
    message.process(this, user.getUsername());
  }

  @OnClose
  public void onClose(Session session) throws IOException {}

  @OnError
  public void onError(Session session, Throwable throwable) {}
}
