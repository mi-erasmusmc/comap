package nl.erasmusmc.mieur.biosemantics.advance.codemapper.authentification;

public enum ProjectPermission {
	
	Editor, Commentator;
	
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
