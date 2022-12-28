package org.biosemantics.codemapper.review;

import java.util.Collection;
import java.util.LinkedList;

import javax.xml.bind.annotation.XmlRootElement;

@XmlRootElement
public class Topic {
	
	int id;
	String heading;
	Action created;
	Action resolved = null;
	Collection<Message> messages;
	
	public Topic(int id, String heading, Action created, Action resolved) {
		this.id = id;
		this.heading = heading;
		this.created = created;
		this.resolved = resolved;
		this.messages = new LinkedList<>();
	}

	@XmlRootElement
	public static class Action {
		String timestamp;
		String user;
		public Action(String user, String timestamp) {
			this.timestamp = timestamp;
			this.user = user;
		}
	}
}
