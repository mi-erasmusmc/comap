package org.biosemantics.codemapper.review;

import com.fasterxml.jackson.annotation.JsonAutoDetect.Visibility;
import com.fasterxml.jackson.annotation.PropertyAccessor;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import javax.websocket.DecodeException;
import javax.websocket.Decoder;
import javax.websocket.EndpointConfig;

public class MessageDecoder implements Decoder.Text<ClientMessage> {

  ObjectMapper mapper = new ObjectMapper();

  @Override
  public ClientMessage decode(String s) throws DecodeException {
    try {
      return mapper.readValue(s, ClientMessage.class);
    } catch (JsonProcessingException e) {
      throw new DecodeException(s, "cannot decode", e);
    }
  }

  @Override
  public boolean willDecode(String s) {
    return (s != null);
  }

  @Override
  public void init(EndpointConfig endpointConfig) {
    mapper.setVisibility(PropertyAccessor.FIELD, Visibility.ANY);
    //		mapper.activateDefaultTyping(ReviewEndpoint.ptv, DefaultTyping.EVERYTHING,
    //    			JsonTypeInfo.As.PROPERTY);
  }

  @Override
  public void destroy() {
    // Close resources
  }
}
