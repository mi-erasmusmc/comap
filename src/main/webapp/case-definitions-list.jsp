<%@page import="java.util.List"%>
<%@ page language="java" contentType="text/html; charset=UTF-8" pageEncoding="UTF-8"%>
<!DOCTYPE html>
<html>
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <title>Insert title here</title>
  </head>
  <body>
    <h1>ADVANCE Code Mapper</h1>
    <ul>
      <li>
        <form method="GET">
          <input type="text" name="n"></input>
          <input type="submit" value="Create"></input>
        </form>
      </li>
<%
  List<String> caseDefinitionNames = (List<String>) request.getAttribute("caseDefinitionNames");
  for (String caseDefinitionName: caseDefinitionNames) {
%>
      <li>
        <form method="GET">
          <input type="hidden" name="n" value="<%=caseDefinitionName%>"></input>
          <input type="submit" value="<%=caseDefinitionName%>"></input>
        </form>
      </li>
<%
  }
%>
    </ul>
  </body>
</html>