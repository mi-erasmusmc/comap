package org.biosemantics.codemapper.review;

import java.util.Collection;
import java.util.LinkedList;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.xml.bind.annotation.XmlRootElement;

@XmlRootElement
public class Topic {

  public int id;
  public String heading;
  public Action created;
  public Action resolved = null;
  public Collection<Message> messages;

  public Topic() {
    this(0, null, null, null);
  }

  public Topic(int id, String heading, Action created, Action resolved) {
    this.id = id;
    this.heading = heading;
    this.created = created;
    this.resolved = resolved;
    this.messages = new LinkedList<>();
  }

  public int getId() {
    return id;
  }

  public void setId(int id) {
    this.id = id;
  }

  public String getHeading() {
    return heading;
  }

  public void setHeading(String heading) {
    this.heading = heading;
  }

  public Action getCreated() {
    return created;
  }

  public void setCreated(Action created) {
    this.created = created;
  }

  public Action getResolved() {
    return resolved;
  }

  public void setResolved(Action resolved) {
    this.resolved = resolved;
  }

  public Collection<Message> getMessages() {
    return messages;
  }

  public void setMessages(Collection<Message> messages) {
    this.messages = messages;
  }

  @XmlRootElement
  public static class Action {
    String timestamp;
    String user;

    public Action() {
      this(null, null);
    }

    public Action(String user, String timestamp) {
      this.timestamp = timestamp;
      this.user = user;
    }

    public String getTimestamp() {
      return timestamp;
    }

    public void setTimestamp(String timestamp) {
      this.timestamp = timestamp;
    }

    public String getUser() {
      return user;
    }

    public void setUser(String user) {
      this.user = user;
    }
  }

  public String[] onCode() {
    Pattern p = Pattern.compile("([A-Z0-9_-])/([A-Z0-9_-])($|:)");
    Matcher m = p.matcher(heading);
    if (m.matches()) {
      return new String[] {m.group(1), m.group(2)};
    } else {
      return null;
    }
  }
}
