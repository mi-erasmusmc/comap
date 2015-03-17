package nl.erasmusmc.mieur.biosemantics.advance.codemapper.web;

import java.io.IOException;

import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import nl.erasmusmc.mieur.biosemantics.advance.codemapper.rest.CodeMapperApplication;

/**
 * Servlet implementation class CodeMapperServlet
 */
@WebServlet("/code-mapper/*")
public class CodeMapperServlet extends HttpServlet {
	private static final long serialVersionUID = 1L;

	@Override
	protected void doGet(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
		System.out.println(CodeMapperApplication.getPeregrineResourceUrl());

		String projectName = request.getParameter("project");
		String caseDefinitionName = request.getParameter("caseDefinition");

		request.setAttribute("projectName", projectName);
		request.setAttribute("caseDefinitionName", caseDefinitionName);
		request.setAttribute("peregrineResourceUrl", CodeMapperApplication.getPeregrineResourceUrl());
		request.getRequestDispatcher("code-mapper.jsp").forward(request, response);
	}
}
