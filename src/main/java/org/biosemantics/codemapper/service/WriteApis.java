package org.biosemantics.codemapper.service;

import java.io.IOException;
import java.io.OutputStream;
import java.util.Collection;
import java.util.List;
import java.util.Map;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.biosemantics.codemapper.ClientState;
import org.biosemantics.codemapper.ClientState.Origin;
import org.biosemantics.codemapper.ClientState.OriginAdd;
import org.biosemantics.codemapper.ClientState.OriginBroader;
import org.biosemantics.codemapper.ClientState.OriginNarrower;
import org.biosemantics.codemapper.ClientState.OriginSearch;
import org.biosemantics.codemapper.ClientState.OriginSpans;
import org.biosemantics.codemapper.ClientState.OriginSuggested;
import org.biosemantics.codemapper.Comment;
import org.biosemantics.codemapper.SourceConcept;

/**
 * A namespace for APIs that write mappings to files.
 */
public class WriteApis {

    static Logger logger = LogManager.getLogger(WriteApis.class);
    
    /**
     * The column headers for the codes of the mapping
     */
    static final String[] CODES_HEADERS = {
            "Coding system", "Code", "Code name", "Concept", "Concept name", "Tags", "Origin"
    };

    /**
     * The interface for writing a mapping to a file.
     */
    public static interface Api {
        
        public String getFileExtension();

        public String getMimetype();

        public void write(OutputStream output, ClientState.State state,
                Map<String, Map<String, Collection<SourceConcept>>> descendants, List<Comment> comments,
                String name, String url) throws IOException;
    }

    /** 
     * Auxiliary to format an array of tags in the export file. 
     * */
    static String formatTags(String[] tagsArray) {
    	if (tagsArray == null)
    		return "";
    	else
    	    return String.join(", ", tagsArray);
    }

    /**
     * An auxiliary to format the origin of a concept in the export file.
     */
    static String origin(Origin<?> origin) {
    	if (origin instanceof OriginBroader)
    		return "BROADER (" + ((OriginBroader) origin).data.cui + ")"; 
    	if (origin instanceof OriginNarrower)
    		return "NARROWER (" + ((OriginNarrower) origin).data.cui + ")"; 
    	if (origin instanceof OriginSuggested)
    		return "SUGGESTED (" + ((OriginSuggested) origin).data.cui + ")"; 
    	if (origin instanceof OriginAdd)
    		return "ADD (" + ((OriginAdd) origin).data + ")"; 
    	if (origin instanceof OriginSearch)
    		return "SEARCH (" + ((OriginSearch) origin).data + ")"; 
    	if (origin instanceof OriginSpans)
    		return "CASEDEF";
    	logger.error("Unknown origin" + origin.getClass().getCanonicalName());
    	return null;
    }
}
