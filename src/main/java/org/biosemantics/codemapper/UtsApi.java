package org.biosemantics.codemapper;

import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import java.util.Set;
import java.util.logging.Level;
import java.util.logging.Logger;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import javax.ws.rs.client.Client;
import javax.ws.rs.client.ClientBuilder;
import javax.ws.rs.client.Entity;
import javax.ws.rs.client.WebTarget;
import javax.ws.rs.core.Form;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.xml.bind.annotation.XmlRootElement;

import org.glassfish.jersey.client.ClientConfig;
import org.glassfish.jersey.logging.LoggingFeature;


public class UtsApi {
    
    private static final String UMLS_VERSION = "2014AB";


    private static Logger logger = Logger.getLogger(Logger.GLOBAL_LOGGER_NAME);
    
    
    private static String LOGIN_URL = "https://utslogin.nlm.nih.gov/cas/v1";
    private static String REST_URL = "https://uts-ws.nlm.nih.gov/rest";
    private static String SERVICE = "http://umlsks.nlm.nih.gov";
    
    private static Pattern TGT_PATTERN = Pattern.compile(".*/api-key/(?<key>[^\"]*).*");
    
    private String apiKey;
    private String tgt;
    
    private Client client;
    private WebTarget loginTarget;
    private WebTarget restTarget;
    
    public UtsApi(String apiKey) {
        this.apiKey = apiKey;
        logger.setLevel(Level.ALL);

        ClientConfig clientConfig = new ClientConfig();
        clientConfig.property(LoggingFeature.LOGGING_FEATURE_VERBOSITY_CLIENT,
                LoggingFeature.Verbosity.PAYLOAD_ANY);
        clientConfig.property(LoggingFeature.LOGGING_FEATURE_LOGGER_NAME, Logger.GLOBAL_LOGGER_NAME);
        clientConfig.property(LoggingFeature.LOGGING_FEATURE_LOGGER_LEVEL, "INFO");
        client = ClientBuilder.newClient(clientConfig);
        loginTarget = client.target(LOGIN_URL);
        restTarget = client.target(REST_URL);
    }
    
    private void login() {
        Form form = new Form()
                .param("apikey", apiKey);
        Response response = loginTarget
                .path("api-key")
                .request()
                .post(Entity.form(form));
        if (response.getStatusInfo().getFamily().equals(Response.Status.Family.SUCCESSFUL)) {
            String string = response.readEntity(String.class);
            Matcher matcher = TGT_PATTERN.matcher(string);
            if (matcher.matches())
                this.tgt = matcher.group("key");
            else
                logger.log(Level.SEVERE, "Cannot login: Does not match pattern: "+string);
        } else
            logger.log(Level.SEVERE, "Cannot login: "+response.getStatusInfo());
    }
    
    private String getTicket() {
        if (tgt == null)
            login();
        Form form = new Form()
                .param("service", SERVICE);
        Response response = loginTarget
            .path("api-key")
            .path(tgt)
            .request()
            .post(Entity.form(form));
        switch (response.getStatusInfo().getFamily()) {
            case SUCCESSFUL:
                return response.readEntity(String.class);
            case CLIENT_ERROR:
                logger.log(Level.INFO, "No TGT/ticket: "+response.getStatusInfo());
            default:
                logger.log(Level.INFO, "Error: "+response.getStatusInfo());
        }
        return null;
    }
    
    @XmlRootElement
    public static class SearchResults {
        public int pageNumber;
        public int pageSize;
        public Result result;
    }
    
    @XmlRootElement
    public static class Result {
        public String classType;
        public List<SearchResult> results;
    }
    
    @XmlRootElement
    public static class SearchResult {
        public String name;
        public String rootSource;
        public String ui;
        public String uri;
    }
    
    public List<String> searchConcepts(String query) throws CodeMapperException {
        String ticket = getTicket();
        Set<String> cuis = new HashSet<>();
        int pageNumber = 1;
        boolean looping = true;
        while (looping) {
            Response response = restTarget
                    .path("search")
                    .path(UMLS_VERSION)
                    .queryParam("ticket", ticket)
                    .queryParam("string", query)
                    .queryParam("pageNumber", pageNumber)
                    .request(MediaType.APPLICATION_JSON)
                    .get();
            switch (response.getStatusInfo().getFamily()) {
                case SUCCESSFUL: {
                    SearchResults results = response.readEntity(SearchResults.class);
                    for (SearchResult result: results.result.results)
                        cuis.add(result.ui);
                    if (results.result.results.isEmpty())
                        looping = false;
                    pageNumber += 1;
                    break;
                }
                case CLIENT_ERROR:
                    looping = false;
                    break;
                default: {
                    logger.log(Level.SEVERE, "Cannot search "+response.getStatusInfo() +"/"+response.getStatusInfo().getFamily());
                    throw CodeMapperException.server("UtsApi: Cannot load results");
                }
            }
            
        }
        return new LinkedList<>(cuis);
    }
    
    public static void main(String[] args) throws CodeMapperException {
        UtsApi utsApi = new UtsApi("UTS-API-KEY");
        utsApi.login();
        System.out.println(utsApi.searchConcepts("GBS"));
    }
}
