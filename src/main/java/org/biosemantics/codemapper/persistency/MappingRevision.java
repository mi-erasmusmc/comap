package org.biosemantics.codemapper.persistency;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import javax.xml.bind.annotation.XmlRootElement;
import org.biosemantics.codemapper.CodeMapperException;
import org.biosemantics.codemapper.MappingData;

@XmlRootElement
public class MappingRevision {
  int version;
  String author;
  String timestamp;
  String summary;
  String mapping;

  public MappingRevision(
      int version, String author, String timestamp, String summary, String mapping) {
    this.version = version;
    this.author = author;
    this.timestamp = timestamp;
    this.summary = summary;
    this.mapping = mapping;
  }

  public int getVersion() {
    return version;
  }

  public void setVersion(int version) {
    this.version = version;
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

  public String getSummary() {
    return summary;
  }

  public void setSummary(String summary) {
    this.summary = summary;
  }

  public String getMapping() {
    return mapping;
  }

  public void setMapping(String mapping) {
    this.mapping = mapping;
  }

  public MappingData parseMappingData() throws CodeMapperException {
    ObjectMapper mapper = new ObjectMapper();
    try {
      return mapper.readValue(mapping, MappingData.class);
    } catch (JsonProcessingException e) {
      throw CodeMapperException.server("could no parse mapping", e);
    }
  }
}
