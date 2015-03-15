
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

/** Encodes an 2-D array of data to CSV. */
function csvEncode(data) {
	function escape(field) {
		if (field == null || field == undefined) {
			return "";
		} else {
			if (typeof field == 'string'
					&& (field.indexOf('"') != -1 || field.indexOf(',') != -1)) {
				return '"' + field.replace('"', '""') + '"';
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