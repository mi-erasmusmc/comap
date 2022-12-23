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

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.biosemantics.codemapper.CodeMapperException;
import org.biosemantics.codemapper.authentification.AuthentificationApi;
import org.biosemantics.codemapper.authentification.User;
import org.biosemantics.codemapper.authentification.AuthentificationApi.ChangePasswordResult;
import org.biosemantics.codemapper.authentification.AuthentificationApi.LoginResult;

@Path("authentification")
public class AuthentificationResource {
	
    private static Logger logger = LogManager.getLogger(AuthentificationResource.class);
	
	AuthentificationApi api = CodeMapperApplication.getAuthentificationApi();
	
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
		logger.info("Try log in " + username);
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
