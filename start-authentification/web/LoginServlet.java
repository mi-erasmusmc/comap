package nl.erasmusmc.mieur.biosemantics.advance.codemapper.web;

import java.io.IOException;

import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import nl.erasmusmc.mieur.biosemantics.advance.codemapper.web.Authentification.User;

/**
 * Servlet implementation class LoginServlet
 */
@WebServlet("/login")
public class LoginServlet extends HttpServlet {
	private static final long serialVersionUID = 1L;

    /**
     * @see HttpServlet#HttpServlet()
     */
    public LoginServlet() {
        super();
        // TODO Auto-generated constructor stub
    }

	/**
	 * @see HttpServlet#doGet(HttpServletRequest request, HttpServletResponse response)
	 */
	@Override
	protected void doGet(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
		// TODO Auto-generated method stub
	}

	/**
	 * @see HttpServlet#doPost(HttpServletRequest request, HttpServletResponse response)
	 */
	@Override
	protected void doPost(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
		String username = request.getParameter("username");
		String password = request.getParameter("password");
		User user = Authentification.authentificate(username, password);
		if (user != null) {
		    request.getSession().setAttribute("user", user); // Put user in session.
		    response.sendRedirect("code-mapper.jsp"); // Go to some start page.
		} else {
		    request.setAttribute("error", "Unknown login, try again"); // Set error msg for ${error}
		    request.getRequestDispatcher("login.jsp").forward(request, response); // Go back to login page.
		}
	}

}
