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

var State =
    (function() {
        "use strict";
        return {
            empty: function() {
                return {
                    cuiAssignment: null,
                    indexing: null, /* {
                        caseDefinition: string,
                        spans: { id: CUI, start: number, end: number, type: [number] }
                        concepts: [{ cui: CUI, preferredName: string, semanticTypes: [number]}]
                    } */
                    mapping: null /* {
                        concepts: [{
                            cui: CUI,
                            codes: { SAB: [{id: CODE, selected: boolean}] }
                    } */
                };
            }
        };
    })();
