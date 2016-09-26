package org.biosemantics.codemapper;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Arrays;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;

import javax.sql.DataSource;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.biosemantics.codemapper.umls_ext.ExtCodingSystem;

/**
 * Database based implementation of the UMLS API used for the code mapper.
 *
 * Two SQL indices in MRREL for CUI1 and CUI2 speed up the lookup of hypernyms/hyponyms:
 * CREATE INDEX MRREL_CUI1 ON MRREL (CUI1);
 * CREATE INDEX MRREL_CUI2 ON MRREL (CUI2)
 *
 * @author benus
 *
 */
public class UmlsApi  {

    private static final List<String> RELATIONS_MORE_GENERAL = Arrays.asList("RB", "PAR");
    private static final List<String> RELATIONS_MORE_SPECIFIC = Arrays.asList("RN", "CHD");
    private static final List<String> RELATIONS_MORE_SPECIFIC_OR_GENERAL = Arrays.asList("RN", "RB", "PAR", "CHD");
    private static final List<String> RELATIONS_LOCAL = Arrays.asList("RL", "SY"); // the relationship is similar or "alike"
    private static final List<String> RELATIONS_SIBLING = Arrays.asList("SIB");

    private static final int SIMILAR_CONCEPTS_MAX_DEPTH = 3;

    private static Logger logger = LogManager.getLogger(UmlsApi.class);

    private DataSource connectionPool;
	private List<String> codingSystemsWithDefinition;
	private List<String> availableCodingSystems;

	public UmlsApi(DataSource connectionPool, List<String> availableCodingSystems, List<String> codingSystemsWithDefinition) {
	    this.connectionPool = connectionPool;
		this.availableCodingSystems = availableCodingSystems;
		this.codingSystemsWithDefinition = codingSystemsWithDefinition;
	}

	private Map<String, ExtCodingSystem> extCodingSystems = new HashMap<>();

	public void registerCodingSystemsExtension(ExtCodingSystem ext) {
		extCodingSystems.put(ext.getCodingSystem().getAbbreviation(), ext);
	}

	/**
	 UMLS2014AB_CoMap> select sab, count(sab) as count from MRCONSO group by sab order by count desc;
		+---------------+---------+
		| sab           | count   |
		+---------------+---------+
		| SNOMEDCT_US   | 1225189 |
		| MSH           |  815608 |
		| RCD           |  347568 |
		| ICD10PCS      |  323730 |
		| ICD10CM       |  173324 |
		| MTH           |  171407 |
		| MDR           |   96729 |
		| ICPC2ICD10ENG |   81799 |
		| ICD9CM        |   40846 |
		| MTHICD9       |   23524 |
		| RCDSY         |   22186 |
		| ICPC2P        |   16897 |
		| ICD10         |   13505 |
		| ATC           |    6503 |
		| MEDLINEPLUS   |    3159 |
		| ICPC2EENG     |    1379 |
		| ICPC          |    1053 |
		| SRC           |     102 |
		+---------------+---------+
	 */
	public List<CodingSystem> getCodingSystems() throws CodeMapperException {

		List<CodingSystem> codingSystems = new LinkedList<>();
		for (ExtCodingSystem ext: extCodingSystems.values())
			codingSystems.add(ext.getCodingSystem());

		String query = "SELECT DISTINCT rsab, son, sf FROM MRSAB WHERE CURVER = 'Y'";
        try (Connection connection = connectionPool.getConnection();
             PreparedStatement statement = connection.prepareStatement(query)) {
			ResultSet result = statement.executeQuery();
			while (result.next()) {
				String rsab = result.getString(1);
				String name = result.getString(2);
				String family = result.getString(2);
				if (availableCodingSystems == null || availableCodingSystems.contains(rsab)) {
					CodingSystem codingSystem = new CodingSystem(rsab, name, family);
					codingSystems.add(codingSystem);
				}
			}
			return codingSystems;
		} catch (SQLException e) {
			throw CodeMapperException.server("Cannot execute query for coding systems", e);
		}
	}

	public Map<String, String> getPreferredNames(Collection<String> cuis) throws CodeMapperException {

		if (cuis.isEmpty())
			return new TreeMap<>();
		else {

			String queryFmt =
					"SELECT DISTINCT cui, str FROM MRCONSO "
					+ "WHERE cui in (%s) "
					+ "AND lat = 'ENG' "
					+ "AND ispref = 'Y' "
					+ "AND ts = 'P' "
					+ "AND stt = 'PF'";
			String query = String.format(queryFmt, Utils.sqlPlaceholders(cuis.size()));

			try (Connection connection = connectionPool.getConnection();
			     PreparedStatement statement = connection.prepareStatement(query)) {

				int offset = 1;
				for (Iterator<String> iter = cuis.iterator(); iter.hasNext(); offset++)
					statement.setString(offset, iter.next());

				ResultSet result = statement.executeQuery();

				Map<String, String> names = new TreeMap<>();
				while (result.next()) {
					String cui = result.getString(1);
					String name = result.getString(2);
					names.put(cui, name);
				}

				Set<String> missings = new TreeSet<>(cuis);
				missings.removeAll(names.keySet());
				for (String missing : missings)
					logger.warn("No preferred name found for CUI " + missing);
				return names;
			} catch (SQLException e) {
				throw CodeMapperException.server("Cannot execute query for preferred names", e);
			}
		}
	}

	public List<UmlsConcept> getCompletions(String q, List<String> codingSystems0, List<String> semanticTypes) throws CodeMapperException {
		if (q.length() < 3) {
			throw CodeMapperException.user("Completions query too short");
		} else {

			Set<String> codingSystems = new HashSet<>();
			for (String abbr: codingSystems0)
				if (extCodingSystems.containsKey(abbr))
					codingSystems.add(extCodingSystems.get(abbr).getCodingSystem().getAbbreviation());
				else
					codingSystems.add(abbr);
                        String query =
                            "SELECT DISTINCT m1.cui, m1.str " // Get the distinct MRCONSO.str
                            + "FROM MRCONSO AS m1 "
                            + "INNER JOIN MRCONSO AS m2 "
                            + "ON m1.cui = m2.cui "
                            + "INNER JOIN MRSTY AS sty "
                            + "ON m1.cui = sty.cui "
                            + "WHERE m1.ts = 'P' " // from preferred terms in MRCONSO ...
                            + "AND m1.stt = 'PF' "
                            + "AND m1.ispref = 'Y' "
                            + "AND m1.lat = 'ENG' "
                            + "AND m1.str LIKE ? " // that match the query string
                            + (codingSystems != null && !codingSystems.isEmpty()
                               ? String.format("AND m2.sab IN (%s) ", // that are in selected coding systems
                                               Utils.sqlPlaceholders(codingSystems.size()))
                               : "")
                            + (semanticTypes != null && !semanticTypes.isEmpty()
                               ? String.format("AND sty.tui IN (%s) ", // that have the selected semantic types
                                               Utils.sqlPlaceholders(semanticTypes.size()))
                               : "");

			try (Connection connection = connectionPool.getConnection();
			     PreparedStatement statement = connection.prepareStatement(query)) {
				int offset = 1;
				statement.setString(offset++, q + "%");
                                if (codingSystems != null && !codingSystems.isEmpty())
                                    for (Iterator<String> iter = codingSystems.iterator(); iter.hasNext(); offset++)
					statement.setString(offset, iter.next());
                                if (semanticTypes != null && !semanticTypes.isEmpty())
                                    for (Iterator<String> iter = semanticTypes.iterator(); iter.hasNext(); offset++)
					statement.setString(offset, iter.next());
				ResultSet result = statement.executeQuery();
				List<UmlsConcept> completions = new LinkedList<>();
				while (result.next()) {
					String cui = result.getString(1);
					String str = result.getString(2);
					UmlsConcept concept = new UmlsConcept(cui, str);
					completions.add(concept);
				}
				return completions;
			} catch (SQLException e) {
				throw CodeMapperException.server("Cannot execute query for completions", e);
			}
		}
	}

	private Map<String, List<String>> getSemanticTypes(Collection<String> cuis) throws CodeMapperException {
		if (cuis.isEmpty())
			return new TreeMap<>();
		else {
			String queryFmt =
					"SELECT DISTINCT cui, tui "
					+ "FROM MRSTY "
					+ "WHERE cui IN (%s) "
					+ "ORDER BY cui, tui";
			String query = String.format(queryFmt, Utils.sqlPlaceholders(cuis.size()));

			try (Connection connection = connectionPool.getConnection();
			     PreparedStatement statement = connection.prepareStatement(query)) {

				int offset = 1;

				for (Iterator<String> iter = cuis.iterator(); iter.hasNext(); offset++)
					statement.setString(offset, iter.next());

                logger.debug(statement);
				ResultSet result = statement.executeQuery();

				Map<String, List<String>> semanticTypes = new TreeMap<>();
				while (result.next()) {
					String cui = result.getString(1);
					String tui = result.getString(2);
					if (!semanticTypes.containsKey(cui))
						semanticTypes.put(cui, new LinkedList<String>());
					semanticTypes.get(cui).add(tui);
				}
				return semanticTypes;
			} catch (SQLException e) {
				throw CodeMapperException.server("Cannot execute query for semantic types", e);
			}
		}
	}
	
	public List<String> getCuisByCodes(List<String> codes, String codingSystem) throws CodeMapperException {
        if (codes == null || codes.isEmpty())
            return new LinkedList<>();
	    if (extCodingSystems.containsKey(codingSystem)) {
	        ExtCodingSystem extCodingSystem = extCodingSystems.get(codingSystem);
	        return extCodingSystem.getCuisForCodes(codes);
	    } else {
	        String queryFmt = "SELECT DISTINCT `cui` FROM `MRCONSO` WHERE `code` IN (%s) and SAB = ?";
	        String query = String.format(queryFmt, Utils.sqlPlaceholders(codes.size()));
	        System.out.println(query);
	        try (Connection connection = connectionPool.getConnection();
                    PreparedStatement statement = connection.prepareStatement(query)) {
	            System.out.println(statement);
	            int offset = 1;
	            for (Iterator<String> iter = codes.iterator(); iter.hasNext(); offset++)
	                statement.setString(offset, iter.next());
	            statement.setString(offset++, codingSystem);
//	            System.out.println(statement);
	            ResultSet result = statement.executeQuery();
	            List<String> cuis = new LinkedList<>();
	            while (result.next()) {
	                String cui = result.getString(1);
	                cuis.add(cui);
	            }
	            return cuis;
            } catch (SQLException e) {
                throw CodeMapperException.server("Cannot execute query for CUIs by codes", e);
            }
	    }
    }
	
	public List<String> getKnownCodes(List<String> codes, String codingSystem) throws CodeMapperException {
        if (codes == null || codes.isEmpty())
            return new LinkedList<>();
        if (extCodingSystems.containsKey(codingSystem)) {
            ExtCodingSystem extCodingSystem = extCodingSystems.get(codingSystem);
            return extCodingSystem.getKnownCodes(codes);
        } else {
            String queryFmt = "SELECT DISTINCT `code` FROM `MRCONSO` "
                    + "WHERE `code` IN (%s) and SAB = ? /* here */";
            String query = String.format(queryFmt, Utils.sqlPlaceholders(codes.size()));
            try (Connection connection = connectionPool.getConnection();
                    PreparedStatement statement = connection.prepareStatement(query)) {
                System.out.println(statement);
                int offset = 1;
                for (Iterator<String> iter = codes.iterator(); iter.hasNext(); offset++)
                    statement.setString(offset, iter.next());
                statement.setString(offset++, codingSystem);
                System.out.println(statement);
                ResultSet result = statement.executeQuery();
                List<String> knownCodes = new LinkedList<>();
                while (result.next()) {
                    String code= result.getString(1);
                    knownCodes.add(code);
                }
                return knownCodes;
            } catch (SQLException e) {
                throw CodeMapperException.server("Cannot execute query for CUIs by codes", e);
            }
        }
	}

    public Map<String, List<SourceConcept>> getSourceConcepts(Collection<String> cuis, Collection<String> codingSystems0)
			throws CodeMapperException {

		if (cuis.isEmpty() || codingSystems0.isEmpty())
			return new TreeMap<>();
		else {

			// Translate extended coding systems to normal coding systems
			Set<String> codingSystems = new HashSet<>();
			List<String> extAbbrs = new LinkedList<>();
			for (String abbr: codingSystems0)
				if (extCodingSystems.containsKey(abbr)) {
					extAbbrs.add(abbr);
					codingSystems.addAll(extCodingSystems.get(abbr).getReferenceCodingSystems());
				}
				else
					codingSystems.add(abbr);

			String queryFmt =
				  	"SELECT DISTINCT cui, sab, code, str, tty "
					+ "FROM MRCONSO "
					+ "WHERE cui IN (%s) AND sab IN (%s) ORDER BY cui, sab, code, str";
			String query = String.format(queryFmt,
					Utils.sqlPlaceholders(cuis.size()),
					Utils.sqlPlaceholders(codingSystems.size()));

			try (Connection connection = connectionPool.getConnection();
			     PreparedStatement statement = connection.prepareStatement(query)) {

				int offset = 1;

				for (Iterator<String> iter = cuis.iterator(); iter.hasNext(); offset++)
					statement.setString(offset, iter.next());

				for (Iterator<String> iter = codingSystems.iterator(); iter.hasNext(); offset++)
					statement.setString(offset, iter.next());

                logger.debug(statement);
				ResultSet result = statement.executeQuery();

				Map<String, List<SourceConcept>> sourceConcepts = new TreeMap<>();
				String lastCui = null, lastSab = null, lastCode = null;
				SourceConcept currentSourceConcept = null;
				while (result.next()) {
					String cui = result.getString(1);
					String sab = result.getString(2);
					String code = result.getString(3);
					String str = result.getString(4);
					String tty = result.getString(5);
					if (!cui.equals(lastCui) || !sab.equals(lastSab) || !code.equals(lastCode)) {
						currentSourceConcept = new SourceConcept();
						currentSourceConcept.setCui(cui);
						currentSourceConcept.setCodingSystem(sab);
						currentSourceConcept.setId(code);
						currentSourceConcept.setPreferredTerm(str);
						if (!sourceConcepts.containsKey(cui))
							sourceConcepts.put(cui, new LinkedList<SourceConcept>());
						sourceConcepts.get(cui).add(currentSourceConcept);
					}
					if ("PT".equals(tty))
						currentSourceConcept.setPreferredTerm(str);
					lastCui = cui;
					lastSab = sab;
					lastCode = code;
				}

				// Create extended source codes
				for (String extAbbr: extAbbrs) {

					ExtCodingSystem extCodingSystem = extCodingSystems.get(extAbbr);

					Map<String, List<SourceConcept>> referenceSourceConcepts = new HashMap<>();
					for (String cui: sourceConcepts.keySet()) {
						referenceSourceConcepts.put(cui, new LinkedList<SourceConcept>());
						List<SourceConcept> sourceConceptsForCui = sourceConcepts.get(cui);
                        for (SourceConcept sourceConcept: new LinkedList<>(sourceConceptsForCui))
							if (extCodingSystem.getReferenceCodingSystems().contains(sourceConcept.getCodingSystem())) {
							    sourceConceptsForCui.remove(sourceConcept);
								referenceSourceConcepts.get(cui).add(sourceConcept);
							}
                        sourceConcepts.put(cui, sourceConceptsForCui);
					}

					Map<String, Map<String, List<SourceConcept>>> extSourceConcepts =
							extCodingSystem.mapCodes(referenceSourceConcepts);

					for (String cui: sourceConcepts.keySet()) {
						Set<SourceConcept> extSourceConceptsForCui = new HashSet<>();
						if (extSourceConcepts.containsKey(cui))
							for (List<SourceConcept> extSourceConceptForCui: extSourceConcepts.get(cui).values())
								extSourceConceptsForCui.addAll(extSourceConceptForCui);
						sourceConcepts.get(cui).addAll(extSourceConceptsForCui);
					}
				}

				Set<String> missings = new TreeSet<>(cuis);
				missings.removeAll(sourceConcepts.keySet());
				for (String missing : missings)
					logger.warn("No UMLS concept found for CUI " + missing);
				return sourceConcepts;
			} catch (SQLException e) {
				throw CodeMapperException.server("Cannot execute query for source concepts", e);
			}
		}
	}

	/**
 		UMLS2014AB_CoMap> select rel, count(rel) as count from MRREL group by rel order by count desc;
		+-----+---------+
		| rel | count   |
		+-----+---------+
		| SIB | 5103112 | // SIBLING_CODING_SYSTEM
		| RO  | 4009440 | //
		| CHD | 1371883 | // MORE_SPECIFIC_CODING_SYSTEM
		| PAR | 1371883 | // MORE_GENERAL_CODING_SYSTEM
		| SY  | 1130820 | // SYNONYM_CODING_SYSTEM
		| RB  |  859489 | // MORE_GENERAL_UMLS
		| RN  |  859489 | // MORE_SPECIFIC_UMLS
		| AQ  |  609748 | //
		| QB  |  609748 | //
		| RQ  |  254628 | // RELATED_POSSIBLY_SYNONYM_UMLS
		+-----+---------+

	 * @param cuis
	 * @param codingSystems
	 * @param relations
	 * @return { cui: { rel: { cui1 for (cui, rel, cui1) in MRREL } for rel in relations } for cui in cuis }
	 * @throws CodeMapperException
	 */
	public Map<String, Map<String, List<UmlsConcept>>> getRelated(List<String> cuis, List<String> codingSystems, List<String> relations) throws CodeMapperException {
		if (cuis.isEmpty() || relations.isEmpty())
			return new TreeMap<>();
		else {
			String queryFmt =
					"SELECT DISTINCT cui1, rel, cui2 FROM MRREL "
					+ "WHERE cui1 in (%s) "
					+ "AND rel in (%s) "
					+ "AND cui1 != cui2";
			String query = String.format(queryFmt,
					Utils.sqlPlaceholders(cuis.size()),
					Utils.sqlPlaceholders(relations.size()));

			try (Connection connection = connectionPool.getConnection();
			     PreparedStatement statement = connection.prepareStatement(query)) {
				int offset = 1;
				for (int ix = 0; ix < cuis.size(); ix++, offset++)
					statement.setString(offset, cuis.get(ix));
				for (int ix = 0; ix < relations.size(); ix++, offset++)
					statement.setString(offset, relations.get(ix));

				ResultSet sqlResults = statement.executeQuery();

				Map<String, Map<String, Set<String>>> related = new TreeMap<>();
				while (sqlResults.next()) {
					String cui1 = sqlResults.getString(1);
					String rel = sqlResults.getString(2);
					String cui2 = sqlResults.getString(3);
					if (!related.containsKey(cui1))
						related.put(cui1, new HashMap<String, Set<String>>());
					if (!related.get(cui1).containsKey(rel))
						related.get(cui1).put(rel, new HashSet<String>());
					related.get(cui1).get(rel).add(cui2);
				}


				Set<String> relatedCuis = new TreeSet<>();
				for (Map<String, Set<String>> rels : related.values())
					for (Set<String> cs : rels.values())
						relatedCuis.addAll(cs);

				Map<String, UmlsConcept> relatedConcepts = getConcepts(relatedCuis, codingSystems);

				Map<String, Map<String, List<UmlsConcept>>> result = new HashMap<>();
				for (String cui1: related.keySet()) {
					result.put(cui1, new HashMap<String, List<UmlsConcept>>());
					for (String rel: related.get(cui1).keySet()) {
						result.get(cui1).put(rel, new LinkedList<UmlsConcept>());
						for (String cui2: related.get(cui1).get(rel))
							result.get(cui1).get(rel).add(relatedConcepts.get(cui2));
					}
				}

				return result;
			} catch (SQLException e) {
				throw CodeMapperException.server("Cannot execute query for related concepts 2", e);
			}
		}
	}

	public Map<String, List<UmlsConcept>> getHyponymsOrHypernyms(List<String> cuis, List<String> codingSystems, boolean hyponymsNotHypernyms) throws CodeMapperException {

		if (cuis.isEmpty())
			return new TreeMap<>();
		else {

			String queryFmt =
					   "SELECT DISTINCT %s "
					+ "FROM MRREL "
					+ "WHERE rel in ('RN', 'CHD') "
					+ "AND %s IN (%s) "
					+ "AND cui1 != cui2 "
					+ "AND (rela IS NULL OR rela = 'isa')";
			String selection = hyponymsNotHypernyms ? "cui1, cui2" : "cui2, cui1";
			String selector = hyponymsNotHypernyms ? "cui1" : "cui2";
			String query = String.format(queryFmt, selection, selector, Utils.sqlPlaceholders(cuis.size()));

			try (Connection connection = connectionPool.getConnection();
			     PreparedStatement statement = connection.prepareStatement(query)) {

				int offset = 1;
				for (int ix = 0; ix < cuis.size(); ix++, offset++)
					statement.setString(offset, cuis.get(ix));

				logger.debug(statement);
				ResultSet result = statement.executeQuery();

				Map<String, Set<String>> related = new TreeMap<>();
				while (result.next()) {
					String cui = result.getString(1);
					String relatedCui = result.getString(2);
					if (!related.containsKey(cui))
						related.put(cui, new TreeSet<String>());
					related.get(cui).add(relatedCui);
				}

				Set<String> relatedCuis = new TreeSet<>();
				for (Collection<String> cs : related.values())
					relatedCuis.addAll(cs);

				Map<String, UmlsConcept> relatedConcepts = getConcepts(relatedCuis, codingSystems);

				Map<String, List<UmlsConcept>> relatedByReference = new TreeMap<>();
				for (String cui: cuis) {
					List<UmlsConcept> concepts = new LinkedList<>();
					if (related.containsKey(cui))
						for (String relatedCui: related.get(cui))
							if (relatedConcepts.containsKey(relatedCui))
								concepts.add(relatedConcepts.get(relatedCui));
					relatedByReference.put(cui, concepts);
				}
				return relatedByReference;
			} catch (SQLException e) {
				throw CodeMapperException.server("Cannot execute query for related concepts", e);
			}
		}
	}

	private Map<String, String> getDefinitions(Collection<String> cuis) throws CodeMapperException {

		if (cuis.isEmpty())
			return new TreeMap<>();
		else {

			String queryFmt = "SELECT DISTINCT cui, sab, def FROM MRDEF WHERE cui IN (%s)";
			String query = String.format(queryFmt, Utils.sqlPlaceholders(cuis.size()));

			try (Connection connection = connectionPool.getConnection();
			     PreparedStatement statement = connection.prepareStatement(query)) {

				int offset = 1;
				for (Iterator<String> iter = cuis.iterator(); iter.hasNext(); offset++)
					statement.setString(offset, iter.next());

				logger.debug(statement);
				ResultSet result = statement.executeQuery();

				Map<String, Map<String, String>> definitionsByVocabularies = new TreeMap<>();
				while (result.next()) {
					String cui = result.getString(1);
					String sab = result.getString(2);
					String def = result.getString(3);
					if (!definitionsByVocabularies.containsKey(cui))
						definitionsByVocabularies.put(cui, new TreeMap<String, String>());
					definitionsByVocabularies.get(cui).put(sab, def);
				}

				Map<String, String> definitions = new TreeMap<>();
				for (String cui : cuis)
					if (!definitionsByVocabularies.containsKey(cui))
						definitions.put(cui, "");
					else
						for (String voc : codingSystemsWithDefinition)
							if (definitionsByVocabularies.get(cui).containsKey(voc)) {
								definitions.put(cui, definitionsByVocabularies.get(cui).get(voc));
								break;
							}

				return definitions;
			} catch (SQLException e) {
				throw CodeMapperException.server("Cannot execute query for definitions", e);
			}
		}
	}

	public Map<String, UmlsConcept> getConcepts(Collection<String> cuis, Collection<String> codingSystems)
			throws CodeMapperException {
		if (cuis.isEmpty())
			return new TreeMap<>();
		else {

			cuis = new LinkedList<>(new TreeSet<>(cuis)); // unique CUIs

	        Map<String, List<SourceConcept>> sourceConcepts = getSourceConcepts(cuis, codingSystems);
	        Map<String, String> preferredNames = getPreferredNames(cuis);
	        Map<String, String> definitions = getDefinitions(cuis);
	        Map<String, List<String>> semanticTypes = getSemanticTypes(cuis);

	        Map<String, UmlsConcept> concepts = new TreeMap<>();
	        for (String cui : cuis) {
	        	UmlsConcept concept = new UmlsConcept();
	        	concept.setCui(cui);
	        	concept.setDefinition(definitions.get(cui));
	        	concept.setPreferredName(preferredNames.get(cui));
	            if (sourceConcepts.containsKey(cui))
	            	concept.setSourceConcepts(sourceConcepts.get(cui));
	            if (semanticTypes.containsKey(cui))
	            	concept.setSemanticTypes(semanticTypes.get(cui));
	            concepts.put(cui, concept);
	        }
	        logger.debug("Found source concepts " + concepts.size());

	        return concepts;
		}
	}
	
    class Node {
	    final String cui;
	    final String relation;
        public Node(String cui, String relation) {
            this.cui = cui;
            this.relation = relation;
        }
        public String toString() {
            return String.format("%s/%s", cui, relation);
        }
	}

    public List<UmlsConcept> getSimilarConcepts(
            List<String> cuis,
            List<String> missingCodingSystems,
            List<String> codingSystems,
            List<String> excludeCuis0
    ) throws CodeMapperException {
        
        if (cuis.isEmpty() || missingCodingSystems.isEmpty())
            return Arrays.asList();
        
        Set<String> excludedCuis = new HashSet<>(excludeCuis0);
        Map<String, List<Node>> paths = new HashMap<>();
        for (String cui: cuis)
            paths.put(cui, new LinkedList<Node>());
        
        for (int i = 0; i <= SIMILAR_CONCEPTS_MAX_DEPTH; i++) {
            Set<String> newCuis = new HashSet<>();
            List<String> resultCuis = new LinkedList<>();
            Map<String, List<String>> cuisByRel = new HashMap<>();
            for (String cui: cuis) {
                String rel = null;
                List<Node> path = paths.get(cui);
                if (path.size() > 0)
                    for (Node node: path)
                        if (RELATIONS_MORE_SPECIFIC_OR_GENERAL.contains(node.relation)) {
                            rel = node.relation;
                            break;
                        }
                if (!cuisByRel.containsKey(rel))
                    cuisByRel.put(rel, new LinkedList<String>());
                cuisByRel.get(rel).add(cui);
            }
            Map<String, Map<String, List<UmlsConcept>>> relateds = new HashMap<>();
            for (String rel0: cuisByRel.keySet()) {
                List<String> relations1;
                if (rel0 == null) {
                    relations1 = new LinkedList<>(RELATIONS_MORE_SPECIFIC_OR_GENERAL);
                    // relations1.addAll(RELATIONS_SIBLING);
                } else if (RELATIONS_MORE_SPECIFIC.contains(rel0))
                    relations1 = new LinkedList<>(RELATIONS_MORE_SPECIFIC);
                else if (RELATIONS_MORE_GENERAL.contains(rel0))
                    relations1 = new LinkedList<>(RELATIONS_MORE_GENERAL);
                else
                    throw new RuntimeException("Impossible relation");
                relations1.addAll(RELATIONS_LOCAL);
                Map<String, Map<String, List<UmlsConcept>>> relateds1 =
                        getRelated(cuisByRel.get(rel0), missingCodingSystems, new LinkedList<>(relations1));
                for (String cui: relateds1.keySet()) {
                    if (!relateds.containsKey(cui))
                        relateds.put(cui, new HashMap<String, List<UmlsConcept>>());
                    for (String rel: relateds1.get(cui).keySet()) {
                        if (!relateds.get(cui).containsKey(rel))
                            relateds.get(cui).put(rel, new LinkedList<UmlsConcept>());
                        relateds.get(cui).get(rel).addAll(relateds1.get(cui).get(rel));
                    }
                }
            }
            for (String cui: relateds.keySet())
                for (String rel: relateds.get(cui).keySet())
                    for (UmlsConcept concept: relateds.get(cui).get(rel))
                        if (!excludedCuis.contains(concept.getCui())) {
                            excludedCuis.add(concept.getCui());
                            List<Node> path = new LinkedList<>(paths.get(cui));
                            path.add(new Node(cui, rel));
                            paths.put(concept.getCui(), path);
                            if (!RELATIONS_LOCAL.contains(rel))
                                newCuis.add(concept.getCui());
                            for (SourceConcept sourceConcept : concept.getSourceConcepts())
                                if (missingCodingSystems.contains(sourceConcept.getCodingSystem())) {
                                    resultCuis.add(concept.getCui());
                                    break;
                                }
                    }
            if (!resultCuis.isEmpty()) {
                Map<String, UmlsConcept> concepts = getConcepts(resultCuis, codingSystems);
                for (UmlsConcept concept: concepts.values())
                    System.out.println(String.format(" - %s: %s", concept, paths.get(concept.getCui())));
                return new LinkedList<>(concepts.values());
            } else
                cuis = new LinkedList<>(newCuis);
        }
        return Arrays.asList();
    }

    private List<UmlsConcept> flattenRelateds(Map<String, Map<String, List<UmlsConcept>>> relateds) {
        List<UmlsConcept> res = new LinkedList<>();
        for (String cui: relateds.keySet())
            for (List<UmlsConcept> concepts: relateds.get(cui).values())
                res.addAll(concepts);
        return res;
    }
}
