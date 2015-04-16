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
            },
            json: function(state) {
                state = angular.clone(state);
                delete state.mapping.numberUnsafedChanges;
                return angular.json(state);
            },
            setIndexing: function(state, caseDefinition, spans, concepts) {
                state.indexing = {
                    caseDefinition: caseDefinition,
                    spans: spans,
                    concepts: concepts
                };
            },
            resetIndexing: function(state) {
              state.indexing = null;   
            }
        };
    })();