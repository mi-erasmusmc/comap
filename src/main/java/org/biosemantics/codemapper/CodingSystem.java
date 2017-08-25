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

import javax.xml.bind.annotation.XmlRootElement;

@XmlRootElement
public class CodingSystem {
	private String abbreviation = null;
	private String name = null;
	private String family = null;

	public CodingSystem() {
	}

	public CodingSystem(String abbrevation, String name, String family) {
		this.abbreviation = abbrevation;
		this.name = name;
		this.family = family;
	}

	public String getAbbreviation() {
		return abbreviation;
	}

	public void setAbbreviation(String abbreviation) {
		this.abbreviation = abbreviation;
	}

	public String getName() {
		return name;
	}

	public void setName(String name) {
		this.name = name;
	}

	public String getFamily() {
		return family;
	}

	public void setFamily(String family) {
		this.family = family;
	}
}
