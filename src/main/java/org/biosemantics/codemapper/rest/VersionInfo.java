package org.biosemantics.codemapper.rest;

import java.util.Set;

public class VersionInfo {
  String umlsVersion;
  String url;
  String contactEmail;
  String projectVersion;
  Set<String> ignoreTermTypes;

  public VersionInfo(
      String umlsVersion,
      String url,
      String contactEmail,
      String projectVersion,
      Set<String> ignoreTermTypes) {
    this.umlsVersion = umlsVersion;
    this.url = url;
    this.contactEmail = contactEmail;
    this.projectVersion = projectVersion;
    this.ignoreTermTypes = ignoreTermTypes;
  }

  public String getUmlsVersion() {
    return umlsVersion;
  }

  public String getUrl() {
    return url;
  }

  public String getContactEmail() {
    return contactEmail;
  }

  public String getProjectVersion() {
    return projectVersion;
  }

  public Set<String> getIgnoreTermTypes() {
    return ignoreTermTypes;
  }
}
