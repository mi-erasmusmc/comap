package org.biosemantics.codemapper.review;

import javax.xml.bind.annotation.XmlRootElement;

@XmlRootElement
public class Post {
	String content;
	String user;
	String timestamp;
	
	Post(String content, String user, String timestamp) {
		this.content = content;
		this.user = user;
		this.timestamp = timestamp;
	}
 }