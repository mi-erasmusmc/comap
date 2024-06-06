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
package org.biosemantics.codemapper.authentification;

public enum ProjectPermission {
  Editor,
  Commentator;

  public static ProjectPermission fromString(String c) {
    switch (c) {
      case "E":
        return Editor;
      case "C":
        return Commentator;
      default:
        return null;
    }
  }
}
