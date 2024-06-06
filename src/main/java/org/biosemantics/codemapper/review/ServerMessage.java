package org.biosemantics.codemapper.review;

import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import com.fasterxml.jackson.annotation.JsonTypeInfo.As;
import java.util.Collection;
import javax.xml.bind.annotation.XmlRootElement;
import org.biosemantics.codemapper.review.ReviewApi.AllTopics;

@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = As.PROPERTY, property = "type")
@JsonSubTypes({
  @JsonSubTypes.Type(value = ServerMessage.NewMessage.class, name = "NewMessage"),
  @JsonSubTypes.Type(value = ServerMessage.NewTopic.class, name = "NewTopic"),
  @JsonSubTypes.Type(value = ServerMessage.CurrentThreads.class, name = "CurrentThreads")
})
public abstract class ServerMessage {

  @XmlRootElement
  public static class NewMessage extends ServerMessage {
    String cui;
    int topicId;
    Message message;
    String sendToken;

    public NewMessage(String cui, int topicId, Message message, String sendToken) {
      this.cui = cui;
      this.topicId = topicId;
      this.message = message;
      this.sendToken = sendToken;
    }
  }

  @XmlRootElement
  public static class NewTopic extends ServerMessage {

    String cui;
    Topic topic;
    String sendToken;

    public NewTopic(String cui, Topic topic, String sendToken) {
      this.cui = cui;
      this.topic = topic;
      this.sendToken = sendToken;
    }
  }

  static class Resolution {
    String user;
    String timestamp;
  }

  static class Thread {
    Resolution resolved;
    Collection<Post> posts;
  }

  @XmlRootElement
  public static class CurrentThreads extends ServerMessage {
    AllTopics allTopics;

    public CurrentThreads(AllTopics allTopics) {
      this.allTopics = allTopics;
    }
  }
}
