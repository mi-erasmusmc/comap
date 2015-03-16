package nl.erasmusmc.mieur.biosemantics.advance.codemapper.rest;

import javax.inject.Inject;
import javax.servlet.http.HttpServletRequest;

import nl.erasmusmc.mieur.biosemantics.advance.codemapper.authentification.User;

import org.glassfish.hk2.api.Factory;

public class UserFactory implements Factory<User> {

    private final HttpServletRequest request;

    @Inject
    public UserFactory(HttpServletRequest request) {
        this.request = request;
    }

    @Override
    public User provide() {
    	return CodeMapperApplication.getAuthentificationApi().getUser(request);
    }

    @Override
    public void dispose(User t) {
    }
}
