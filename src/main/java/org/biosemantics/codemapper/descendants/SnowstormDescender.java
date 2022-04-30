package org.biosemantics.codemapper.descendants;

import java.util.Arrays;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.Map;
import java.util.Queue;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.concurrent.Callable;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicReference;

import javax.ws.rs.ProcessingException;
import javax.ws.rs.client.Client;
import javax.ws.rs.client.ClientBuilder;
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

    private final String codingSystem;
    private final String baseUri;
    private final String branch;

    public SnowstormDescender(String codingSystem, String baseUri, String branch) {
        this.codingSystem = codingSystem;
        this.baseUri = baseUri;
        this.branch = branch;
    }

    public String getCodingSystem() {
        return codingSystem;
    }

    @Override
    public Map<String, Collection<SourceConcept>> getDescendants(Collection<String> conceptIds)
            throws CodeMapperException {
        return getDescendantsConcurrentCached(new HashSet<>(conceptIds), 8);
    }

    /**
     * Get the descendants of some codes, sequentially.
     */
    public Map<String, Collection<SourceConcept>> getDescendantsSequential(
            Collection<String> conceptIds) throws CodeMapperException {
        Client client = ClientBuilder.newClient();
        Map<String, Collection<SourceConcept>> descendants = new TreeMap<>();
        for (String conceptId : conceptIds) {
            for (String resolvedConceptId : resolveInactiveConcept(client, conceptId, 10)) {
                Collection<SourceConcept> concepts = descendants.computeIfAbsent(conceptId, id -> new LinkedList<>());
                concepts.addAll(getDescendants(client, resolvedConceptId));
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
                        descendants.addAll(getDescendants(client, conceptId));
                    }
                    return Collections.singletonMap(conceptId0, descendants);
                }
            }));
        }
        executor.shutdown();

        try {
            Map<String, Collection<SourceConcept>> result = new TreeMap<>();
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
    
    private ConcurrentMap<String, Collection<SourceConcept>> cache = new ConcurrentHashMap<>();

    /**
     * Get the descendants of some codes, concurrently and cached.
     */
    public Map<String, Collection<SourceConcept>> getDescendantsConcurrentCached(
            Collection<String> conceptIds, int threads) throws CodeMapperException {
        ExecutorService executor = Executors.newFixedThreadPool(threads);
        AtomicReference<CodeMapperException> exception = new AtomicReference<CodeMapperException>();
        Map<String, Future<Collection<SourceConcept>>> futures = new HashMap<>();
        for (final String conceptId0 : conceptIds) {
            futures.put(conceptId0, executor.submit(() -> {
                return cache.computeIfAbsent(conceptId0, conceptId00 -> {
                    try {
                        Collection<SourceConcept> descendants = new LinkedList<>();
                        final Client client = ClientBuilder.newClient();
						for (String conceptId : resolveInactiveConcept(client, conceptId00, 5)) {
                            descendants.addAll(getDescendants(client, conceptId));
                        }
                        return descendants;
                    } catch (CodeMapperException e) {
                        exception.updateAndGet(e1 -> e1 != null ? e1 : e); // keep first
                        return null;
                    }
                });
            }));
        }
        executor.shutdown();

        try {
            if (exception.get() != null) {
                throw exception.get();
            }
            Map<String, Collection<SourceConcept>> result = new TreeMap<>();
            for (Map.Entry<String, Future<Collection<SourceConcept>>> entry : futures.entrySet()) {
                result.put(entry.getKey(), entry.getValue().get());
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

//    // More concurrency doesn't really help because the bottleneck are calls to Snowstorm with many pages
//    public Map<String, Collection<SourceConcept>> getDescendantsConcurrent2(
//            Collection<String> conceptIds, int threads) throws CodeMapperException {
//        try {
//            Map<String, Collection<String>> relateds; 
//            {
//                ExecutorService executor = Executors.newFixedThreadPool(threads);
//                Map<String, Future<Collection<String>>> futures = new HashMap<>();
//                
//                for (final String conceptId0 : conceptIds) {
//                    futures.put(conceptId0, executor.submit(() -> {
//                        final Client client = ClientBuilder.newClient();
//                        return resolveInactiveConcept(client, conceptId0, 5);
//                    }));
//                }
//                executor.shutdown();
//
//                relateds = new HashMap<>();
//                for (Entry<String, Future<Collection<String>>> entry : futures.entrySet()) {
//                    relateds.put(entry.getKey(), entry.getValue().get());
//                }
//            }
//            
//            Map<String, Collection<SourceConcept>> descendants;
//            {
//                ExecutorService executor = Executors.newFixedThreadPool(threads);
//                Map<String, Future<Collection<SourceConcept>>> futures = new HashMap<>();
//                
//                for (Collection<String> conceptIds1 : relateds.values()) {
//                    for (String conceptId : conceptIds1) {
//                        if (futures.containsKey(conceptId)) {
//                            logger.debug("Contains " + conceptId);
//                        } else {
//                            logger.debug("Contains not yet " + conceptId);
//                        futures.put(conceptId, // conceptId1 ->
//                            executor.submit(() -> {
//                                Client client = ClientBuilder.newClient();
//                                return getDescendants(client, conceptId);
//                            }));   
//                        }
//                    }
//                }
//                executor.shutdown();
//                logger.debug("Futures count: " + futures.size());
//
//                descendants = new HashMap<>();
//                for (Entry<String, Future<Collection<SourceConcept>>> entry: futures.entrySet()) {
//                    descendants.put(entry.getKey(), entry.getValue().get());
//                }
//                logger.debug("Descendants count: " + descendants.size());
//            }
//            
//            Map<String, Collection<SourceConcept>> result = new TreeMap<>();
//            for (final String conceptId0 : relateds.keySet()) {
//                for (String conceptId : relateds.get(conceptId0)) {
//                    Collection<SourceConcept> concepts = descendants.get(conceptId);
//                    Collection<SourceConcept> sofar = result.putIfAbsent(conceptId0, concepts);
//                    if (sofar != null)
//                        sofar.addAll(concepts);
//                }
//            }
//            return result;
//        } catch (InterruptedException e) {
//            throw CodeMapperException.server("execution was interupted", e);
//        } catch (ExecutionException e) {
//            if (e.getCause() instanceof CodeMapperException) {
//                throw (CodeMapperException) e.getCause();
//            } else {
//                throw CodeMapperException.server("exception getting descendents", e);
//            }
//        }
//    }

    /**
     * Associations that are used to resolve inactive concepts.
     */
    private static Set<String> ACTIVE_ASSOCIATIONS = new HashSet<>(
            Arrays.asList("POSSIBLY_EQUIVALENT_TO", "SAME_AS", "REPLACED_BY"));
    
    class ConceptDepth {
    	String conceptId;
    	int depth;
    	ConceptDepth(String conceptId, int depth) {
    		this.conceptId = conceptId;
    		this.depth = depth;
    	}
    }
    
    /**
     * Resolve inactive concepts to active concepts using the association targets of
     * the concept. Association targets may be in turn be inactive, and are further
     * resolved until the given depth..
     */
     private Collection<String> resolveInactiveConcept(Client client, String conceptId, int maxDepth) throws CodeMapperException {
        String uri = String.format("%s/browser/%s/concepts/%s", baseUri, branch, conceptId);
        Collection<String> res = new HashSet<>();
        Queue<ConceptDepth> todo = new LinkedList<>();
        todo.add(new ConceptDepth(conceptId, 0));
        while (true) {
        	ConceptDepth cd = todo.poll();
        	if (cd == null)
        		break;
        	res.add(cd.conceptId);
            if (cd.depth == maxDepth) {
                continue;
            } 
            Response response = client.target(uri).request(MediaType.APPLICATION_JSON).get();
            if (response.getStatus() == 404) {
                logger.info("concept not found " + cd.conceptId);
                continue;
            }
            if (response.getStatusInfo().getFamily() != Family.SUCCESSFUL) {
                throwError("get concept", response);
            }
            BrowserConcept concept = response.readEntity(BrowserConcept.class);
            if (concept.active) {
                logger.trace("keep active concept " + concept.conceptId);
                continue;
            }
            if (concept.associationTargets == null) {
                logger.info("No association targets");
                continue;
            }
            for (String key : concept.associationTargets.keySet()) {
            	if (ACTIVE_ASSOCIATIONS.contains(key)) {
            		for (String associated : concept.associationTargets.get(key)) {
            			todo.add(new ConceptDepth(associated, cd.depth + 1));
            		}
            	}
            }
        }
        return res;
    }

    @SuppressWarnings("unused")
	private Collection<String> resolveInactiveConceptRec(Client client, String conceptId, int depth)
            throws CodeMapperException {
        String uri = String.format("%s/browser/%s/concepts/%s", baseUri, branch, conceptId);
        Response response = client.target(uri).request(MediaType.APPLICATION_JSON).get();
        if (response.getStatus() == 404) {
            logger.info("concept not found " + conceptId);
            return Collections.emptyList(); // Continue resolving other concepts
        }
        if (response.getStatusInfo().getFamily() != Family.SUCCESSFUL) {
            throwError("get concept", response);
        }
        BrowserConcept concept = response.readEntity(BrowserConcept.class);
        if (concept.active) {
            logger.trace("keep active concept " + concept.conceptId);
            return Collections.singletonList(concept.conceptId);
        } 
        if (depth == 0) {
            logger.info("Didn't find active concept for " + conceptId);
            return Collections.emptyList();
        } 
        if (concept.associationTargets == null) {
            logger.info("No association targets");
            return Collections.emptyList();
        }
        Collection<String> res = new HashSet<>();
        res.add(conceptId);
        for (String key : concept.associationTargets.keySet()) {
        	if (ACTIVE_ASSOCIATIONS.contains(key)) {
        		for (String associated : concept.associationTargets.get(key)) {
        			// Recurse; inactive concept may be associate to other inactive
        			// concepts
        			// TODO replace the recursion with a loop and a todo list
        			res.addAll(resolveInactiveConcept(client, associated, depth - 1));
        		}
        	}
        }
        logger.trace("associate inactive concept " + concept.conceptId + " to " + res);
        return res;
    }

    private Collection<SourceConcept> getDescendants(Client client, String conceptId) throws CodeMapperException {
        logger.debug("getDescendants " + conceptId);
        String uri = String.format("%s/%s/concepts/%s/descendants", baseUri, branch, conceptId);
        Collection<SourceConcept> result = new TreeSet<>();
        int total = 0, offset = 0;
        do {
            final Response response = client.target(uri)
                    .queryParam("offset", offset).queryParam("limit", 150)
                    .request(MediaType.APPLICATION_JSON).get();
            if (response.getStatusInfo().getFamily() == Family.CLIENT_ERROR) {
                SnowstormError err = response.readEntity(SnowstormError.class);
                logger.info("descendants not found for " + conceptId + ": " +
                        response.getStatusInfo().getReasonPhrase() + " - " + err);
                break; // Don't continue paging
            }
            if (response.getStatusInfo().getFamily() != Family.SUCCESSFUL) {
                throwError("get descendants", response);
            }
            DescendantsResult res = response.readEntity(DescendantsResult.class);
            for (DescendentsConcept descConcept : res.items) {
                SourceConcept sourceConcept = new SourceConcept();
                sourceConcept.setCodingSystem(codingSystem);
                sourceConcept.setId(descConcept.conceptId);
                sourceConcept.setPreferredTerm(descConcept.fsn.term);
                result.add(sourceConcept);
            }
            total = res.total;
            offset = res.offset + res.items.length;
        } while (result.size() < total);
        logger.info("descendants found for " + conceptId);
        return result;
    }

    private void throwError(String descr, Response response) throws CodeMapperException {
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
        
        SnowstormDescender descender = 
                new SnowstormDescender("SNOMEDCT_US", "https://snowstorm.test-nictiz.nl",
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
