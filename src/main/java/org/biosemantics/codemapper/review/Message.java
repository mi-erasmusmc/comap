package org.biosemantics.codemapper.review;

import javax.xml.bind.annotation.XmlRootElement;

@XmlRootElement
public class Message {
  int id;
  String username;
  String timestamp;
  String content;
  boolean isRead;

  public Message() {
    this(0, null, null, null, false);
  }

  public Message(int id, String username, String timestamp, String content, boolean isRead) {
    this.id = id;
    this.username = username;
    this.timestamp = timestamp;
    this.content = content;
    this.isRead = isRead;
  }

  public int getId() {
    return id;
  }

  public void setId(int id) {
    this.id = id;
  }

  public String getUsername() {
    return username;
  }

  public void setUsername(String username) {
    this.username = username;
  }

  public String getTimestamp() {
    return timestamp;
  }

  public void setTimestamp(String timestamp) {
    this.timestamp = timestamp;
  }

  public String getContent() {
    return content;
  }

  public void setContent(String content) {
    this.content = content;
  }

  public boolean isRead() {
    return isRead;
  }

  public void setRead(boolean isRead) {
    this.isRead = isRead;
  }
}
