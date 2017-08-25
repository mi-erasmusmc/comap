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
package org.biosemantics.codemapper.umls_ext;

import java.util.Collection;
import java.util.List;
import java.util.Map;

import org.biosemantics.codemapper.CodeMapperException;
import org.biosemantics.codemapper.CodingSystem;
import org.biosemantics.codemapper.SourceConcept;

public interface ExtCodingSystem {

	/** Extended coding system. */
	public CodingSystem getCodingSystem();

	/** Abbreviation of the reference coding system in UMLS. */
	public Collection<String> getReferenceCodingSystems();

	/**
	 * Map codes in reference coding system to codes in extended coding
	 * system.
	 *
	 * @param codes
	 *            A mapping from CUIs to codes in the reference coding
	 *            system.
	 * @return A mapping from CUIs to a mapping from codes in the reference
	 *         coding systems to source concepts in the extended coding
	 *         system
	 * @throws CodeMapperException
	 */
	public Map<String, Map<String, List<SourceConcept>>> mapCodes(Map<String, List<SourceConcept>> codes) throws CodeMapperException;

	/** Create a mapping from codes in the extended mapping to CUIs that correspond to the codes 
	 * @throws CodeMapperException */
    public List<String> getCuisForCodes(List<String> codes) throws CodeMapperException;

    /** Filter the given codes to codes known in the extended coding system. */
    public List<String> getKnownCodes(List<String> codes) throws CodeMapperException;
}
