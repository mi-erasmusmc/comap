package nl.erasmusmc.mieur.biosemantics.advance.codemapper;

import java.sql.SQLException;


public class CodeMapperException extends Exception {

	public CodeMapperException(String msg) {
		super(msg);
	}

	public CodeMapperException(String msg, Exception e) {
		super(msg, e);
	}

	public CodeMapperException(SQLException e) {
		super(e);
	}

	private static final long serialVersionUID = 1L;

}
