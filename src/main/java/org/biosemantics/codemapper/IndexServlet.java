package org.biosemantics.codemapper;

import java.io.IOException;

import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

@WebServlet(name="IndexServlet", urlPatterns="/index.jsp")
public class IndexServlet extends HttpServlet {

    private static final long serialVersionUID = 1L;

    public void doGet (HttpServletRequest req,
                       HttpServletResponse res)
      throws ServletException, IOException
    {
        req.setCharacterEncoding("UTF-8");
        getServletContext()
            .getRequestDispatcher("/WEB-INF/index.jsp")
            .forward(req, res);
    }
}
