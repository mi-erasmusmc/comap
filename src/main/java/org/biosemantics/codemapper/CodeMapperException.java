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

import javax.ws.rs.BadRequestException;
import javax.ws.rs.InternalServerErrorException;
import javax.ws.rs.WebApplicationException;
import javax.ws.rs.core.Response.Status.Family;

public class CodeMapperException extends Exception {

	private Family errorFamily;

	private CodeMapperException(Family errorFamily, String msg) {
		super(msg);
		this.errorFamily = errorFamily;
	}

	private CodeMapperException(Family errorFamily, String msg, Exception e) {
		super(msg, e);
		this.errorFamily = errorFamily;
	}

	private CodeMapperException(Family errorFamily, Exception e) {
		super(e);
		this.errorFamily = errorFamily;
	}

	public static CodeMapperException user(String msg) {
		return new CodeMapperException(Family.CLIENT_ERROR, msg);
	}

	public static CodeMapperException server(String msg, Exception e) {
		return new CodeMapperException(Family.SERVER_ERROR, msg, e);
	}

	public static CodeMapperException server(String msg) {
		return new CodeMapperException(Family.SERVER_ERROR, msg);
	}

	public WebApplicationException asWebApplicationException() {
		switch (errorFamily) {
			case CLIENT_ERROR:
				printStackTrace();
				System.out.println(this);
				return new BadRequestException(getMessage());
			case SERVER_ERROR:
				this.printStackTrace();
				System.out.println(this);
				return new InternalServerErrorException();
			default:
				return null;
		}
	}


	private static final long serialVersionUID = 1L;

}
