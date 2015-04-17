
var State =
    (function() {
        "use strict";
        return {
            empty: function() {
                return {
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