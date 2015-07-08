package nl.erasmusmc.mieur.biosemantics.advance.codemapper;

import javax.xml.bind.annotation.XmlRootElement;

@XmlRootElement
public class Comment {
	
	private String author;
	private String timestamp;
	private String cui;
	private String content;
	
	public Comment() {
	}
	public Comment(String cui, String author, String timestamp, String content) {
		this.cui = cui;
		this.author = author;
		this.timestamp = timestamp;
		this.content = content;
	}
	public String getCui() {
		return cui;
	}
	public void setCui(String cui) {
		this.cui = cui;
	}
	public String getAuthor() {
		return author;
	}
	public void setAuthor(String author) {
		this.author = author;
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
	
}
