/*******************************************************************************
 * Copyright 2017 Erasmus Medical Center, Department of Medical Informatics.
 * 
 * This program shall be referenced as “Codemapper”.
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 * 
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 ******************************************************************************/
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

import jersey.repackaged.com.google.common.base.Objects;


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
        client = ClientBuilder.newClient(clientConfig);
        loginTarget = client.target(LOGIN_URL);
        restTarget = client.target(REST_URL);
        login();
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
        for (int retry=0; retry<2; retry++, login()) {
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
                    logger.log(Level.INFO, String.format("No TGT/ticket (retry %d): %s", retry, response.getStatusInfo()));
                    break;
                default:
                    logger.log(Level.INFO, "Error: "+response.getStatusInfo());
                    return null;
            }
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
        public SearchResult() {}
        public SearchResult(String ui, String name) {
            this.ui = ui;
            this.name = name;
        }
        @Override
        public boolean equals(Object obj) {
            if (obj == this) return true;
            if (!(obj instanceof SearchResult)) {
                return false;
            }
            SearchResult result = (SearchResult) obj;
            return Objects.equal(name, result.name) &&
                    Objects.equal(rootSource, result.rootSource) &&
                    Objects.equal(ui, result.ui) &&
                    Objects.equal(uri, result.uri);
        }
        
    }
    
    public List<String> searchConcepts(String query) throws CodeMapperException {
        Set<String> cuis = new HashSet<>();
        loop:
        for (int pageNumber = 1; ; pageNumber++) {
            String ticket = getTicket();
            Response response = restTarget
                    .path("search")
                    .path(UMLS_VERSION)
                    .queryParam("ticket", ticket)
                    .queryParam("string", query)
                    .queryParam("pageNumber", pageNumber)
                    .request(MediaType.APPLICATION_JSON)
                    .get();
            response.bufferEntity();
            switch (response.getStatusInfo().getFamily()) {
                case SUCCESSFUL: { 
                    SearchResults results = response.readEntity(SearchResults.class);
                    if (results.result.results.isEmpty() ||
                        results.result.results.size() == 1 &&
                        results.result.results.get(0).equals(new SearchResult("NONE", "NO RESULTS")))
                        break loop;
                    for (SearchResult result: results.result.results)
                        cuis.add(result.ui);
                    if (results.result.results.isEmpty())
                        break loop;
                    break;
                }
                case CLIENT_ERROR:
                    break loop;
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
        System.out.println(utsApi.searchConcepts("GBS"));
    }
}
