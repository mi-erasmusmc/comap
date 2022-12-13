package org.biosemantics.codemapper.review;

import java.io.IOException;

import javax.xml.bind.annotation.XmlRootElement;

import org.biosemantics.codemapper.CodeMapperException;
import org.biosemantics.codemapper.rest.CodeMapperApplication;

import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import com.fasterxml.jackson.annotation.JsonTypeInfo.As;

@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = As.PROPERTY, property = "type")
@JsonSubTypes({ @JsonSubTypes.Type(value = ClientMessage.SendMessage.class, name = "SendMessage"),
		@JsonSubTypes.Type(value = ClientMessage.NewTopic.class, name = "NewTopic") })
public abstract class ClientMessage {

	public abstract void process(ReviewEndpoint endpoint, String user) throws IOException;

	@XmlRootElement
	static class SendMessage extends ClientMessage {
		String cui;
		int topicId;
		Message message;
		String token;

		public void process(ReviewEndpoint endpoint, String user) throws IOException {
			try {
				CodeMapperApplication.getReviewApi().newMessage(endpoint.project,
						endpoint.caseDefinition, cui, topicId, message.content, user);
			} catch (CodeMapperException e) {
				throw new IOException(e);
			}
		}
	}

	@XmlRootElement
	static class NewTopic extends ClientMessage {
		String cui;
		Message message;
		String token;

		@Override
		public void process(ReviewEndpoint endpoint, String user) throws IOException {
			try {
				CodeMapperApplication.getReviewApi().newTopic(endpoint.project, endpoint.caseDefinition,
						cui, message.content, user);
			} catch (CodeMapperException e) {
				throw new IOException(e);
			}
		}
	}
}