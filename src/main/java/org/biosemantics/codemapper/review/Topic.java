package org.biosemantics.codemapper.review;

import java.util.Collection;
import java.util.LinkedList;

import javax.xml.bind.annotation.XmlRootElement;

@XmlRootElement
public class Topic {
	
	int id;
	String heading;
	Resolved resolved = null;
	Collection<Message> messages;
	
	public Topic(int id, String heading, Resolved resolved) {
		this.id = id;
		this.heading = heading;
		this.resolved = resolved;
		this.messages = new LinkedList<>();
	}

	@XmlRootElement
	public static class Resolved {
		String timestamp;
		String user;
		public Resolved(String user, String timestamp) {
			this.timestamp = timestamp;
			this.user = user;
		}
	}
}
