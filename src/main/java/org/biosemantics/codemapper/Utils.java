package org.biosemantics.codemapper;

public class Utils {

	public static String sqlPlaceholders(int number) {
		StringBuilder sb = new StringBuilder();
		for (int ix = 0; ix < number; ix++) {
			if (ix > 0)
				sb.append(", ");
			sb.append("?");
		}
		return sb.toString();
	}

}
