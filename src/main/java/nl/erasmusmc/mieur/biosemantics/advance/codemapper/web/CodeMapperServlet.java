package nl.erasmusmc.mieur.biosemantics.advance.codemapper.web;

import java.io.IOException;

import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import nl.erasmusmc.mieur.biosemantics.advance.codemapper.rest.CodeMapperApplication;

@WebServlet("/code-mapper")
public class CodeMapperServlet extends HttpServlet {
	private static final long serialVersionUID = 1L;

	@Override
	protected void doGet(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {

		String caseDefinitionName = request.getParameter("n");

		if (caseDefinitionName == null) {
			request.setAttribute("caseDefinitionNames", CodeMapperApplication.getPersistencyApi().getCaseDefinitionsNames());
			request.getRequestDispatcher("case-definitions-list.jsp").forward(request, response);
		} else {
			request.setAttribute("peregrineResourceUrl", CodeMapperApplication.getPeregrineResourceUrl());
			request.setAttribute("caseDefinitionName", caseDefinitionName);
			request.getRequestDispatcher("code-mapper.jsp").forward(request, response);
		}
	}
}
