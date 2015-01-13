package nl.erasmusmc.mieur.biosemantics.advance.codemapper;


public class CodeMapperException extends Exception {

	public CodeMapperException(String msg) {
		super(msg);
	}

	public CodeMapperException(String msg, Exception e) {
		super(msg, e);
	}

	private static final long serialVersionUID = 1L;

}
