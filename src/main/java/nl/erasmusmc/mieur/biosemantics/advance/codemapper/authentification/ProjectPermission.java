package nl.erasmusmc.mieur.biosemantics.advance.codemapper.authentification;

public enum ProjectPermission {
	
	Admin, Member, Commentator;
	
	public static ProjectPermission fromString(String c) {
		switch (c) {
			case "M":
				return Member;
			case "C":
				return Commentator;
			case "A":
				return Admin;
			default:
				return null;
		}
	}
}
