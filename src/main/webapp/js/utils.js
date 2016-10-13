
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

function getPreferredName(concept) {
	return concept.preferredName;
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

function setEquals(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (a.length != b.length) return false;
    a = a.slice();
    b = b.slice();
    for (var i = 0; i < a.length; ++i) {
      if (a[i] !== b[i]) {
          return false;
      }
    }
    return true;
}

function intersection(a1, a2) {
    return a1.filter(function(v) {
        return a2.indexOf(v) != -1;
    });
}

function difference(a1, a2) {
    return a1.filter(function(v) {
        return a2.indexOf(v) == -1;
    });
}

function flatten(a) {
    return [].concat.apply([], a);
}

var objectMap = function(obj, f) {
    var res = {};
    angular.forEach(obj, function(v, k) {
        var v1 = f(v, k);
        if (v1 !== undefined) {
            res[k] = v1;
        }
    });
    return res;
}

function unique(v, ix, arr) {
    return ix == arr.indexOf(v);
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

function getOrigin(concept) {
    if (concept.origin.type == "spans") {
        return "In case definition (\"" + concept.origin.data.text + "\")";
    }
    if (concept.origin.type == "hyponym") {
        return "Narrower than " + concept.cui + " (" + concept.origin.data.preferredName + ")";
    }
    if (concept.origin.type == "hypernym") {
        return "Broader than " + concept.cui + " (" + concept.origin.data.preferredName + ")";
    }
    if (concept.origin.type == "search") {
        return "By query \"" + concept.origin.data + "\"";
    }
    if (concept.origin.type == "add") {
        return "Added";
    }
    return "?";
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
    });
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

if (!String.prototype.format) {
    String.prototype.format = function() {
      var args = arguments;
      return this.replace(/{(\d+)}/g, function(match, number) { 
        return typeof args[number] != 'undefined'
          ? args[number]
          : match
        ;
      });
    };
  }
