package org.biosemantics.codemapper.review;

import javax.xml.bind.annotation.XmlRootElement;

@XmlRootElement
public class Message {
	int id;
	String username;
	String timestamp;
	String content;
	boolean isRead;
	
	public Message(int id, String username, String timestamp, String content, boolean isRead) {
		this.id = id;
		this.username = username;
		this.timestamp = timestamp;
		this.content = content;
		this.isRead = isRead;
	}
}
