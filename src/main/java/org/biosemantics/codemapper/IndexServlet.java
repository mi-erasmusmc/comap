package org.biosemantics.codemapper;

import java.io.IOException;

import javax.servlet.ServletContext;
import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.biosemantics.codemapper.rest.CodeMapperApplication;

@WebServlet(name="IndexServlet", urlPatterns="/index.jsp")
public class IndexServlet extends HttpServlet {

    private static final long serialVersionUID = 1L;
    
    public void doGet (HttpServletRequest req,
                       HttpServletResponse res)
      throws ServletException, IOException
    {
        req.setCharacterEncoding("UTF-8");
        ServletContext context = getServletContext();
        context.setAttribute("CODEMAPPER_UMLS_VERSION", CodeMapperApplication.properties.getProperty("codemapper-umls-version"));
        context.setAttribute("CODEMAPPER_CONTACT_EMAIL", CodeMapperApplication.properties.getProperty("codemapper-contact-email"));
        context.setAttribute("CODEMAPPER_URL", CodeMapperApplication.properties.getProperty("codemapper-url"));
        context
            .getRequestDispatcher("/WEB-INF/index.jsp")
            .forward(req, res);
    }
}
