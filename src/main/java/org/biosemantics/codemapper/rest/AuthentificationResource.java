package org.biosemantics.codemapper.rest;

import javax.servlet.http.HttpServletRequest;
import javax.ws.rs.FormParam;
import javax.ws.rs.GET;
import javax.ws.rs.InternalServerErrorException;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;

import org.biosemantics.codemapper.CodeMapperException;
import org.biosemantics.codemapper.authentification.AuthentificationApi;
import org.biosemantics.codemapper.authentification.User;
import org.biosemantics.codemapper.authentification.AuthentificationApi.ChangePasswordResult;
import org.biosemantics.codemapper.authentification.AuthentificationApi.LoginResult;

@Path("authentification")
public class AuthentificationResource {
	
	AuthentificationApi api = CodeMapperApplication.getAuthentificationApi();
	
	public static void assertAuthentificated(User user) {
		if (user == null)
			throw new UnauthorizedException();
	}

	@GET
	@Path("user")
	@Produces(MediaType.APPLICATION_JSON)
	public User getUser(@Context HttpServletRequest request) {
		return api.getUser(request);
	}

	@POST
	@Path("login")
	@Produces(MediaType.APPLICATION_JSON)
	public LoginResult login(@FormParam("username") String username, @FormParam("password") String password, @Context HttpServletRequest request) {
		try {
			return api.login(username, password, request);
		} catch (CodeMapperException e) {
			e.printStackTrace();
			throw new InternalServerErrorException(e);
		}
	}

	@POST
	@Path("logout")
	@Produces(MediaType.APPLICATION_JSON)
	public void logout(@Context HttpServletRequest request) {
		api.logout(request);
	}
	
	@POST
	@Path("change-password")
	@Produces(MediaType.APPLICATION_JSON)
	public ChangePasswordResult changePassword(@Context HttpServletRequest request, @FormParam("oldPassword") String oldPassword,
			@FormParam("newPassword") String newPassword) {
		try {
			return api.changePassword(getUser(request), oldPassword, newPassword);
		} catch (CodeMapperException e) {
			e.printStackTrace();
			throw new InternalServerErrorException(e);
		}
	}
}
