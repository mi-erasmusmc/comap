/**
 * ***************************************************************************** Copyright 2017
 * Erasmus Medical Center, Department of Medical Informatics.
 *
 * <p>This program shall be referenced as “Codemapper”.
 *
 * <p>This program is free software: you can redistribute it and/or modify it under the terms of the
 * GNU Affero General Public License as published by the Free Software Foundation, either version 3
 * of the License, or (at your option) any later version.
 *
 * <p>This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
 * without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * <p>You should have received a copy of the GNU Affero General Public License along with this
 * program. If not, see <http://www.gnu.org/licenses/>.
 * ****************************************************************************
 */
package org.biosemantics.codemapper.rest;

import javax.inject.Inject;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpSession;
import org.glassfish.hk2.api.Factory;

public class HttpSessionFactory implements Factory<HttpSession> {

  private final HttpServletRequest request;

  @Inject
  public HttpSessionFactory(HttpServletRequest request) {
    this.request = request;
  }

  @Override
  public HttpSession provide() {
    return request.getSession();
  }

  @Override
  public void dispose(HttpSession t) {}
}
