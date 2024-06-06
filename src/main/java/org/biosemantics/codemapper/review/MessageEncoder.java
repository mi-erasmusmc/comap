package org.biosemantics.codemapper.review;

import com.fasterxml.jackson.annotation.JsonAutoDetect.Visibility;
import com.fasterxml.jackson.annotation.PropertyAccessor;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import javax.websocket.EncodeException;
import javax.websocket.Encoder;
import javax.websocket.EndpointConfig;

public class MessageEncoder implements Encoder.Text<ServerMessage> {

  ObjectMapper mapper = new ObjectMapper();

  @Override
  public String encode(ServerMessage message) throws EncodeException {
    try {
      return mapper.writeValueAsString(message);
    } catch (JsonProcessingException e) {
      throw new EncodeException(message, "cannot encode", e);
    }
  }

  @Override
  public void init(EndpointConfig endpointConfig) {
    mapper.setVisibility(PropertyAccessor.FIELD, Visibility.ANY);
    //		mapper.activateDefaultTyping(ReviewEndpoint.ptv, DefaultTyping.EVERYTHING,
    //				JsonTypeInfo.As.PROPERTY);
  }

  @Override
  public void destroy() {}
}
