package nl.erasmusmc.mieur.biosemantics.advance.codemapper.web;

import java.io.IOException;

import javax.servlet.Filter;
import javax.servlet.FilterChain;
import javax.servlet.FilterConfig;
import javax.servlet.ServletException;
import javax.servlet.ServletRequest;
import javax.servlet.ServletResponse;
import javax.servlet.annotation.WebFilter;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

/**
 * Servlet Filter implementation class LoginFilter
 */
@WebFilter(urlPatterns = { "/code-mapper.jsp" },
servletNames = { "nl.erasmusmc.mieur.biosemantics.advance.codemapper.rest.CodeMapperApplication" })
public class LoginFilter implements Filter {

    /**
     * Default constructor.
     */
    public LoginFilter() {
        // TODO Auto-generated constructor stub
    }

	/**
	 * @see Filter#destroy()
	 */
	@Override
	public void destroy() {
		// TODO Auto-generated method stub
	}

	/**
	 * @see Filter#doFilter(ServletRequest, ServletResponse, FilterChain)
	 */
	@Override
	public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain) throws IOException, ServletException {
		if (((HttpServletRequest) request).getSession().getAttribute("user") != null) {
		    chain.doFilter(request, response); // User is logged in, just continue request.
		} else {

			String path = request.getServerName() + "/login.jsp";
		    ((HttpServletResponse) response).sendRedirect(path); // Not logged in, show login page. You can eventually show the error page instead.
		}
		// pass the request along the filter chain
		chain.doFilter(request, response);
	}

	/**
	 * @see Filter#init(FilterConfig)
	 */
	@Override
	public void init(FilterConfig fConfig) throws ServletException {
	}

}
