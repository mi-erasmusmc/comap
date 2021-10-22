package org.biosemantics.codemapper.descendants;

import java.util.Arrays;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import javax.ws.rs.ProcessingException;
import javax.ws.rs.client.Client;
import javax.ws.rs.client.ClientBuilder;
import javax.ws.rs.client.WebTarget;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.Response.Status.Family;

import org.apache.logging.log4j.Level;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.biosemantics.codemapper.CodeMapperException;
import org.biosemantics.codemapper.SourceConcept;
import org.biosemantics.codemapper.descendants.DescendersApi.SpecificDescender;
import org.biosemantics.codemapper.rest.CodeMapperApplication;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

public class SnowstormDescender implements SpecificDescender {

    private static Logger logger = LogManager.getLogger(SnowstormDescender.class);

    public static final String SNOMEDCT_US = "SNOMEDCT_US";

    private final String baseUri;
    private final String branch;

    public SnowstormDescender(String baseUri, String branch) {
        this.baseUri = baseUri;
        this.branch = branch;
    }

    public String getCodingSystem() {
        return SNOMEDCT_US;
    }

    public Map<String, Collection<SourceConcept>> getDescendants(Collection<String> conceptIds)
            throws CodeMapperException {
        return getDescendantsConcurrent(new HashSet<>(conceptIds), 8);
    }

    /**
     * Get the descendants of some codes, sequentially.
     */
    public Map<String, Collection<SourceConcept>> getDescendantsSequential(
            Collection<String> conceptIds) throws CodeMapperException {
        Client client = ClientBuilder.newClient();
        Map<String, Collection<SourceConcept>> descendants = new HashMap<>();
        for (String conceptId : conceptIds) {
            for (String resolvedConceptId : resolveInactiveConcept(client, conceptId, 10)) {
                if (!descendants.containsKey(conceptId)) {
                    descendants.put(conceptId, new LinkedList<>());
                }
                descendants.get(conceptId).addAll(getDescendants(resolvedConceptId));
            }
        }
        return descendants;
    }

    /**
     * Get the descendants of some codes, concurrently.
     */
    public Map<String, Collection<SourceConcept>> getDescendantsConcurrent(
            Collection<String> conceptIds, int threads) throws CodeMapperException {
        ExecutorService executor = Executors.newFixedThreadPool(threads);
        Collection<Future<Map<String, Collection<SourceConcept>>>> futures = new LinkedList<>();
        for (final String conceptId0 : conceptIds) {
            futures.add(executor.submit(new Callable<Map<String, Collection<SourceConcept>>>() {
                @Override
                public Map<String, Collection<SourceConcept>> call() throws Exception {
                    final Client client = ClientBuilder.newClient();
                    Collection<SourceConcept> descendants = new LinkedList<>();
                    for (String conceptId : resolveInactiveConcept(client, conceptId0, 5)) {
                        descendants.addAll(getDescendants(conceptId));
                    }
                    return Collections.singletonMap(conceptId0, descendants);
                }
            }));
        }
        executor.shutdown();

        try {
            Map<String, Collection<SourceConcept>> result = new HashMap<>();
            for (Future<Map<String, Collection<SourceConcept>>> future : futures) {
                result.putAll(future.get());
            }
            return result;
        } catch (InterruptedException e) {
            throw CodeMapperException.server("execution was interupted", e);
        } catch (ExecutionException e) {
            if (e.getCause() instanceof CodeMapperException) {
                throw (CodeMapperException) e.getCause();
            } else {
                throw CodeMapperException.server("exception getting descendents", e);
            }
        }
    }

    /**
     * Associations that are used to resolve inactive concepts.
     */
    private static Set<String> ACTIVE_ASSOCIATIONS = new HashSet<>(
            Arrays.asList("POSSIBLY_EQUIVALENT_TO", "SAME_AS", "REPLACED_BY'"));

    /**
     * Resolve inactive concepts to active concepts using the association targets of
     * the concept. Since association targets may be in turn be inactive, the
     * resolution is recursive, and terminates when depth = 0.
     */
    private Collection<String> resolveInactiveConcept(Client client, String conceptId, int depth)
            throws CodeMapperException {
        String uri = String.format("%s/browser/%s/concepts/%s", baseUri, branch, conceptId);
        Response response = client.target(uri).request(MediaType.APPLICATION_JSON).get();
        if (response.getStatus() == 404) {
            logger.info("concept not found " + conceptId);
            return Collections.emptyList(); // Continue resolving other concepts
        }
        if (response.getStatusInfo().getFamily() != Family.SUCCESSFUL) {
            handleError("get concept", response);
        }
        BrowserConcept concept = response.readEntity(BrowserConcept.class);
        if (concept.active) {
            logger.trace("keep active concept " + concept.conceptId);
            return Collections.singletonList(concept.conceptId);
        } else {
            if (depth == 0) {
                logger.info("Didn't find active concept for " + conceptId);
                return Collections.emptyList();
            } else {
                Collection<String> res = new HashSet<>();
                for (String key : concept.associationTargets.keySet()) {
                    if (ACTIVE_ASSOCIATIONS.contains(key)) {
                        for (String associated : concept.associationTargets.get(key)) {
                            // Recurse; inactive concept may be associate to other inactive
                            // concepts
                            res.addAll(resolveInactiveConcept(client, associated, depth - 1));
                        }
                    }
                }
                logger.trace("associate inactive concept " + concept.conceptId + " to " + res);
                return res;
            }
        }
    }

    private Collection<SourceConcept> getDescendants(String conceptId) throws CodeMapperException {
        String uri = String.format("%s/%s/concepts/%s/descendants", baseUri, branch, conceptId);
        WebTarget target = ClientBuilder.newClient().target(uri);
        Collection<SourceConcept> descendants = new HashSet<>();
        int total = 0, offset = 0;
        do {
            final Response response = target.queryParam("offset", offset)
                    .request(MediaType.APPLICATION_JSON).get();
            if (response.getStatusInfo().getFamily() == Family.CLIENT_ERROR) {
                SnowstormError err = response.readEntity(SnowstormError.class);
                logger.info("descendants not found for " + conceptId + ": " +
                        response.getStatusInfo().getReasonPhrase() + " - " + err);
                break; // Don't continue paging
            }
            if (response.getStatusInfo().getFamily() != Family.SUCCESSFUL) {
                handleError("get descendants", response);
            }
            DescendantsResult res = response.readEntity(DescendantsResult.class);
            logger.info("descendants found for " + conceptId);
            for (DescendentsConcept descConcept : res.items) {
                SourceConcept sourceConcept = new SourceConcept();
                sourceConcept.setCodingSystem(SNOMEDCT_US);
                sourceConcept.setId(descConcept.conceptId);
                sourceConcept.setPreferredTerm(descConcept.fsn.term);
                descendants.add(sourceConcept);
            }
            total = res.total;
            offset = res.offset + res.items.length;
        } while (descendants.size() < total);
        return descendants;
    }

    private void handleError(String descr, Response response) throws CodeMapperException {
        SnowstormError err = null;
        try {
            err = response.readEntity(SnowstormError.class);
        } catch (ProcessingException e) {
        }
        throw CodeMapperException.server(
                "Cannot " + descr + " from Snowstorm: " + response.getStatusInfo().getReasonPhrase()
                        + (err != null ? " (" + err + ")" : ""));
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class SnowstormError {
        String error;
        String message;

        @Override
        public String toString() {
            return error + ": " + message;
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class BrowserConcept {
        boolean active;
        String conceptId;
        Map<String, String[]> associationTargets;
    }

    public static class Fsn {
        String lang;
        String term;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class DescendentsConcept {
        String conceptId;
        Fsn fsn;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class DescendantsResult {
        DescendentsConcept[] items;
        int limit;
        int offset;
        int total;
    }

    public static void main(String[] args) throws CodeMapperException {
        CodeMapperApplication.reconfigureLog4j2(Level.TRACE);
        
        SnowstormDescender descender = new SnowstormDescender("https://snowstorm.test-nictiz.nl",
                "MAIN/2021-07-31");
        Map<String, Collection<SourceConcept>> descendants = descender.getDescendantsSequential(Arrays.asList("158164000"));
        System.out.println("" + descendants.size());
        for (String conceptId : descendants.keySet()) { 
            System.out.println("- " + conceptId + ": " + descendants.get(conceptId));
        }
        descendants = descender.getDescendantsConcurrent(Arrays.asList("158164000"), 4);
        System.out.println("" + descendants.size());
        for (String conceptId : descendants.keySet()) { 
            System.out.println("- " + conceptId + ": " + descendants.get(conceptId));
        }
    } 
}
