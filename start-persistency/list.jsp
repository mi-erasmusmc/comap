<%@page import="java.util.Map"%>
<%@ page language="java" contentType="text/html; charset=UTF-8"
    pageEncoding="UTF-8"%>
<!DOCTYPE html PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN" "http://www.w3.org/TR/html4/loose.dtd">
<html>
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <title>ADVANCE Code Mapper - Case definitions</title>
  </head>
  <body>
  <h1>ADVANCE Code Mapper - Case definitions</h1>
  <ul>
<%
Map<String, String> caseDefinitions = (Map<String, String>) request.getAttribute("caseDefinitions");

for(Map.Entry<String, String> caseDefinition : caseDefinitions.entrySet()) {
%>
      <li>
        <a href="code-mapper?caseDefinition=${caseDefinition}">${caseDefinition}</a>
      </li>
<%
}
%>
  </ul>
  <form>
    <input type="text" name="name" />
    <input type="submit" />
  </form>
  </body>
</html>