/*******************************************************************************
 * Copyright 2017 Erasmus Medical Center, Department of Medical Informatics.
 * 
 * This program shall be referenced as “Codemapper”.
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 * 
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 ******************************************************************************/
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
        context.setAttribute("CODEMAPPER_UMLS_VERSION", CodeMapperApplication.getPropConfig("codemapper-umls-version"));
        context.setAttribute("CODEMAPPER_CONTACT_EMAIL", CodeMapperApplication.getPropConfig("codemapper-contact-email"));
        context.setAttribute("CODEMAPPER_URL", CodeMapperApplication.getPropConfig("codemapper-url"));
        context.setAttribute("PROJECT_VERSION", CodeMapperApplication.getPropConfig("project.version"));
        context
            .getRequestDispatcher("/WEB-INF/index.jsp")
            .forward(req, res);
    }
}
