package nl.erasmusmc.mieur.biosemantics.advance.codemapper.web;

import java.io.IOException;

import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import nl.erasmusmc.mieur.biosemantics.advance.codemapper.rest.CodeMapperApplication;

@WebServlet("/case-definitions-list")
public class CaseDefinitionsListServlet extends HttpServlet {

	private static final long serialVersionUID = 1L;

	@Override
	protected void doGet(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
		request.setAttribute("caseDefinitions", CodeMapperApplication.getPersistencyApi().getCaseDefinitionsNames());
		request.getRequestDispatcher("case-definitions-list.jsp").forward(request, response);
	}

}
