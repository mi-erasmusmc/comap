
function error(msg, consoleArgs) {
    msg = "ERROR: " + msg;
    console.log(msg, consoleArgs);
    alert(msg);
}


/**
 * AngularJS sends data for HTTP POST JSON - this header is to encode it as FORM
 * data.
 */
var FORM_ENCODED_POST = {
    headers : {
        'Content-Type' : 'application/x-www-form-urlencoded'
    },
    transformRequest : function(obj) {
        var str = [];
        for ( var key in obj) {
            if (obj[key] instanceof Array) {
                for ( var idx in obj[key]) {
                    var subObj = obj[key][idx];
                    str.push(encodeURIComponent(key) + "="
                            + encodeURIComponent(subObj));
                }
            } else {
                str.push(encodeURIComponent(key) + "="
                        + encodeURIComponent(obj[key]));
            }
        }
        return str.join("&");
    }
};

/**
 * Generate a CUI from a string that represents an integer. cuiOf("123") ==
 * "C000123"
 */
function cuiOfId(id) {
    return 'C' + Array(8 - id.length).join('0') + id;
}

function getCui(concept) {
    if (concept.cui === undefined) {
        error("getCui", concept);
    }
    return concept.cui;
}

function reduceConcept(concept) {
    return {
        cui: concept.cui,
        preferredName: concept.preferredName
    };
}

function getAbbreviation(codingSystem) {
    if (codingSystem.abbreviation === undefined) {
        error("getAbbreviation", codingSystem);
    }
    return codingSystem.abbreviation;
}

function getType(semanticType) {
    if (semanticType.type === undefined) {
        error("getType", semanticType);
    }
    return semanticType.type;
}

function compareByCodeCount(c1, c2) {
    return c2.sourceConceptsCount - c1.sourceConceptsCount;
}

/** Encodes an 2-D array of data to CSV. */
function csvEncode(data) {
    function escape(field) {
        if (field == null || field == undefined) {
            return "";
        } else {
            if (typeof field == 'string'
                    && (field.indexOf('"') != -1 || field.indexOf(',') != -1)) {
                return '"' + field.replace(/"/g, '""') + '"';
            } else {
                return "" + field;
            }
        }
    }
    var result = "";
    data.forEach(function(row) {
        result += row.map(escape).join(', ') + '\n';
    });
    return result;
}

function pluralize(noun, arrayOrNumber) {
    var count = angular.isArray(arrayOrNumber) ? arrayOrNumber.length : arrayOrNumber; 
    if (count == 1) {
        return noun;
    } else {
        return noun + "s";
    }
}

function showConcept(concept) {
    return concept.preferredName;
}

function showConcepts(concepts) {
    return concepts.map(showConcept).join(", ");
}

function isFirstOccurrence(v, ix, a) {
    return a.indexOf(v) == ix;
}

function group(array, by) {
    var res = {};
    array.forEach(function(elt) {
        var key = by(elt);
        if (!res.hasOwnProperty(key)) {
            res[key] = [];
        }
        res[key].push(elt);
    });
    return res;
}

function items(obj) {
    var res = [];
    angular.forEach(data, function(key, elts) {
    res.push({
            key: key,
            elts: elts
        });
    });
    return res;
}

function byKey(array, by) {
    var res = {};
    array.forEach(function(elt) {
        res[by(elt)] = elt;
    })
    return res;
}

function order(orders) {
    return function(x, y) {
        var ix;
        for (ix = 0; ix < orders.length; ix++) {
            var res = orders[ix](x, y);
            if (res != 0)
                return res;
        }
        return 0;
    };
}

function highlight(dataService, text, spans, concepts) {
    console.log("RENDER", text && text.length);
    var conceptsByCui = byKey(concepts, getCui);
    var spansByStart = group(spans, function(span) { return span.start; });
    
    var result = "";
    var ends = [];
    var here = 0;
    angular.forEach(text, function(c) {
        var hereStartSpans = spansByStart[here] || [];
        hereStartSpansByEnd = group(hereStartSpans, function(span) { return span.end; });
        angular.forEach(hereStartSpansByEnd, function(spans, end) {
            var cuis = spans
                .map(function(span) {
                    return cuiOfId(span.id);
                });
            var types = []
                .concat.apply([], cuis.map(function(cui) {
                    return conceptsByCui[cui].semanticTypes;
                }))
                .filter(isFirstOccurrence);
            var groups = types
                .map(function(type) {
                    return dataService.semanticTypesByType[type].group;
                })
                .filter(isFirstOccurrence);
            var title = cuis
                .map(function(cui) {
                    var concept = conceptsByCui[cui];
                    var typeNames = concept.semanticTypes
                        .map(function(type) {
                            return dataService.semanticTypesByType[type].description;
                        });
                    return concept.preferredName + " (" + typeNames.join(", ") + ")";
                })
                .join(", ");
            result += "<div class='concept' title='" + title.replace("'", "\\'") + "'>";
            ends.push(end);
        });
        if (c == '\n') {
            result += "<br/>";
        } else {
            result += $('<div/>').text(c).html();
        }
        ends.sort();
        while (ends.length > 0 && ends[0] == here) {
            result += "</div>"
            ends.shift();
        }
        here += 1;
    });
    while (ends.length > 0) {  
        result += "</div>"
        ends.shift();
    }
    return "<div class='highlight'>" + result + "</div>";
}
