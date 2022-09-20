package org.biosemantics.codemapper.service;

import java.io.IOException;
import java.io.OutputStream;
import java.util.Arrays;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.biosemantics.codemapper.ClientState;
import org.biosemantics.codemapper.Comment;
import org.biosemantics.codemapper.SourceConcept;

public class WriteTsvApi implements WriteApis.Api {

    static final String FILE_EXTENSION = "tsv";
    static final String MIME_TYPE = "text/tab-separated-values";

    @Override
    public String getFileExtension() {
        return FILE_EXTENSION;
    }

    @Override
    public String getMimetype() {
        return MIME_TYPE;
    }

    @Override
    public void write(OutputStream output, ClientState.State state,
            Map<String, Map<String, Collection<SourceConcept>>> descendants, List<Comment> comments,
            String name, String url) throws IOException {
        writeRow(output, WriteApis.CODES_HEADERS);
        for (String codingSystem : state.codingSystems) {
        	// {tags -> {code}}
            Map<String, Set<String>> allPrintedCodes = new HashMap<>();
            for (ClientState.Concept concept : state.mapping.concepts) {
                String tags = WriteApis.formatTags(concept.tags);
                if (!allPrintedCodes.containsKey(tags)) {
                	allPrintedCodes.put(tags, new HashSet<>());
                }
                Set<String> printedCodes = allPrintedCodes.get(tags);
                boolean printedCode = false;
                org.biosemantics.codemapper.ClientState.SourceConcept[] sourceConcepts = concept.codes.get(codingSystem).clone();
				Arrays.sort(sourceConcepts, Comparator.comparing(c -> c.id));
				for (ClientState.SourceConcept sourceConcept : sourceConcepts) {
                    if (!printedCodes.contains(sourceConcept.id)) {
                        writeRow(output, codingSystem, sourceConcept.id,
                                sourceConcept.preferredTerm, concept.cui, concept.preferredName,
                                tags, WriteApis.origin(concept.origin));
                        printedCodes.add(sourceConcept.id);
                        printedCode = true;
                    }
                    if (descendants.get(codingSystem) != null
                            && descendants.get(codingSystem).get(sourceConcept.id) != null) {
						SourceConcept[] descConcepts = descendants.get(codingSystem).get(sourceConcept.id).toArray(new SourceConcept[0]);
						Arrays.sort(descConcepts);
                        for (SourceConcept c : descConcepts) {
                            if (!printedCodes.contains(c.getId())) {
                                writeRow(output, codingSystem, c.getId(), c.getPreferredTerm(), "",
                                        "", tags, WriteXlsApi.desc(sourceConcept.id));
                                printedCodes.add(c.getId());
                                printedCode = true;
                            }
                        }
                    }
                }
                if (!printedCode) {
                    writeRow(output, codingSystem, WriteXlsApi.NO_CODE, "", concept.cui,
                            concept.preferredName, tags, "");
                }
            }
        }
    }

    private void writeRow(OutputStream output, String... args) throws IOException {
        String[] args1 = new String[args.length];
        for (int i = 0; i < args.length; i++) {
            args1[i] = args[i].replace('\t', ' ');
        }
        String line = String.join("\t", Arrays.asList(args1)) + "\n";
        output.write(line.getBytes());
    }
}
