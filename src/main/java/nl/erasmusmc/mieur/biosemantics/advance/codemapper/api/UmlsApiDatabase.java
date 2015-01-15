package nl.erasmusmc.mieur.biosemantics.advance.codemapper.api;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Collection;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;

import org.apache.log4j.Logger;

import nl.erasmusmc.mieur.biosemantics.advance.codemapper.CodingSystem;
import nl.erasmusmc.mieur.biosemantics.advance.codemapper.SourceConcept;
import nl.erasmusmc.mieur.biosemantics.advance.codemapper.UmlsConcept;

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
public class UmlsApiDatabase implements UmlsApi {

	private Connection connection;
	private String uri;
	private Properties connectionProperties;
	private List<String> availableVocabularies;
	private List<String> vocabulariesWithDefinition;
	private static Logger logger = Logger.getLogger("AdvanceCodeMapper");

	public UmlsApiDatabase(String uri, Properties connectionProperties, List<String> availableVocabularies,
			List<String> vocabulariesWithDefinition) {
		this.uri = uri;
		this.connectionProperties = connectionProperties;
		this.availableVocabularies = availableVocabularies;
		this.vocabulariesWithDefinition = vocabulariesWithDefinition;
	}

	private Connection getConnection() throws SQLException {
		if (connection == null || connection.isClosed())
			connection = DriverManager.getConnection(uri, connectionProperties);
		return connection;
	}

	private String placeholders(int number) {
		StringBuilder sb = new StringBuilder();
		for (int ix = 0; ix < number; ix++) {
			if (ix > 0)
				sb.append(", ");
			sb.append("?");
		}
		return sb.toString();
	}

	@Override
	public List<CodingSystem> getCodingSystems() throws CodeMapperException {

		String query = "SELECT DISTINCT rsab, son, sf FROM MRSAB WHERE CURVER = 'Y'";
		try (PreparedStatement statement = getConnection().prepareStatement(query)) {
			ResultSet result = statement.executeQuery();
			List<CodingSystem> codingSystems = new LinkedList<>();
			while (result.next()) {
				String sab = result.getString(1);
				String name = result.getString(2);
				String family = result.getString(2);
				if (availableVocabularies == null || availableVocabularies.contains(sab)) {
					CodingSystem codingSystem = new CodingSystem(sab, name, family);
					codingSystems.add(codingSystem);
				}
			}
			return codingSystems;
		} catch (SQLException e) {
			throw new CodeMapperException(e);
		}
	}

	public Map<String, String> getPreferredNames(List<String> cuis) throws CodeMapperException {

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
			String query = String.format(queryFmt, placeholders(cuis.size()));

			try (PreparedStatement statement = connection.prepareStatement(query)) {

				int offset = 1;
				for (int ix = 0; ix < cuis.size(); ix++, offset++)
					statement.setString(offset, cuis.get(ix));

				logger.debug(statement);
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
				throw new CodeMapperException(e);
			}
		}
	}

	public Map<String, List<SourceConcept>> getSourceConcepts(List<String> cuis, List<String> vocabularies)
			throws CodeMapperException {

		if (cuis.isEmpty())
			return new TreeMap<>();
		else {

			if (vocabularies == null)
				vocabularies = availableVocabularies;

			String sabPlaceholders;
			if (vocabularies != null)
				sabPlaceholders = String.format("AND sab IN (%s)", placeholders(vocabularies.size()));
			else
				sabPlaceholders = "";

			String queryFmt = "SELECT DISTINCT cui, sab, code, str, tty FROM MRCONSO "
					+ "WHERE cui IN (%s) %s ORDER BY cui, sab, code, str";
			String query = String.format(queryFmt, placeholders(cuis.size()), sabPlaceholders);

			try (PreparedStatement statement = getConnection().prepareStatement(query)) {

				int offset = 1;
				for (int ix = 0; ix < cuis.size(); ix++, offset++)
					statement.setString(offset, cuis.get(ix));
				if (vocabularies != null)
					for (int ix = 0; ix < vocabularies.size(); ix++, offset++)
						statement.setString(offset, vocabularies.get(ix));

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
						currentSourceConcept.setVocabulary(sab);
						currentSourceConcept.setId(code);
						currentSourceConcept.setPreferredTerm(str);
						if (!sourceConcepts.containsKey(cui))
							sourceConcepts.put(cui, new LinkedList<SourceConcept>());
						sourceConcepts.get(cui).add(currentSourceConcept);
					}
					if ("PT".equals(tty))
						currentSourceConcept.setPreferredTerm(str);
					currentSourceConcept.getTerms().add(str);
					lastCui = cui;
					lastSab = sab;
					lastCode = code;
				}

				Set<String> missings = new TreeSet<>(cuis);
				missings.removeAll(sourceConcepts.keySet());
				for (String missing : missings)
					logger.warn("No UMLS concept found for CUI " + missing);
				return sourceConcepts;
			} catch (SQLException e) {
				throw new CodeMapperException(e);
			}
		}
	}

	private Map<String, List<UmlsConcept>> getRelated(List<String> cuis, boolean hyponymsNotHypernyms) throws CodeMapperException {

		if (cuis.isEmpty())
			return new TreeMap<>();
		else {

			String queryFmt = "SELECT DISTINCT %s "
					+ "FROM MRREL "
					+ "WHERE rel in ('RN', 'CHD') "
					+ "AND %s IN (%s) "
					+ "AND cui1 != cui2 "
					+ "AND (rela IS NULL OR rela = 'isa')";
			String selection = hyponymsNotHypernyms ? "cui1, cui2" : "cui2, cui1";
			String selector = hyponymsNotHypernyms ? "cui1" : "cui2";
			String query = String.format(queryFmt, selection, selector, placeholders(cuis.size()));

			try (PreparedStatement statement = getConnection().prepareStatement(query)) {

				int offset = 1;
				for (int ix = 0; ix < cuis.size(); ix++, offset++)
					statement.setString(offset, cuis.get(ix));

				logger.debug(statement);
				ResultSet result = statement.executeQuery();

				Map<String, Set<String>> relatedCuis = new TreeMap<>();
				while (result.next()) {
					String cui = result.getString(1);
					String relatedCui = result.getString(2);
					if (!relatedCuis.containsKey(cui))
						relatedCuis.put(cui, new TreeSet<String>());
					relatedCuis.get(cui).add(relatedCui);
				}

				Set<String> relatedCuisUnique = new TreeSet<>();
				for (Collection<String> cs : relatedCuis.values())
					relatedCuisUnique.addAll(cs);
				Map<String, String> names = getPreferredNames(new LinkedList<>(relatedCuisUnique));

				Map<String, List<UmlsConcept>> related = new TreeMap<>();
				for (String cui : cuis)
					if (relatedCuis.containsKey(cui)) {
						related.put(cui, new LinkedList<UmlsConcept>());
						for (String relatedCui : relatedCuis.get(cui))
							related.get(cui).add(new UmlsConcept(relatedCui, names.get(relatedCui)));
					}
				return related;
			} catch (SQLException e) {
				throw new CodeMapperException(e);
			}
		}
	}

	private Map<String, String> getDefinitions(List<String> cuis) throws CodeMapperException {

		if (cuis.isEmpty())
			return new TreeMap<>();
		else {

			String queryFmt = "SELECT DISTINCT cui, sab, def FROM MRDEF WHERE cui IN (%s)";
			String query = String.format(queryFmt, placeholders(cuis.size()));

			try (PreparedStatement statement = getConnection().prepareStatement(query)) {

				int offset = 1;
				for (int ix = 0; ix < cuis.size(); ix++, offset++)
					statement.setString(offset, cuis.get(ix));

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
						for (String voc : vocabulariesWithDefinition)
							if (definitionsByVocabularies.get(cui).containsKey(voc)) {
								definitions.put(cui, definitionsByVocabularies.get(cui).get(voc));
								break;
							}

				return definitions;
			} catch (SQLException e) {
				throw new CodeMapperException(e);
			}
		}
	}

	@Override
	public List<UmlsConcept> getConcepts(List<String> cuis, List<String> vocabularies)
			throws CodeMapperException {

		if (cuis.isEmpty())
			return new LinkedList<>();
		else {

			cuis = new LinkedList<>(new TreeSet<>(cuis)); // unique CUIs

	        Map<String, List<SourceConcept>> sourceConcepts = getSourceConcepts(cuis, vocabularies);
	        Map<String, String> preferredNames = getPreferredNames(cuis);
	        Map<String, List<UmlsConcept>> hyponyms = getRelated(cuis, true);
	        Map<String, List<UmlsConcept>> hypernyms = getRelated(cuis, false);
	        Map<String, String> definitions = getDefinitions(cuis);

	        List<UmlsConcept> concepts = new LinkedList<>();
	        for (String cui : cuis) {
	        	UmlsConcept concept = new UmlsConcept();
	        	concept.setCui(cui);
	        	concept.setDefinition(definitions.get(cui));
	        	concept.setPreferredName(preferredNames.get(cui));
	            List<SourceConcept> sourceConcept = sourceConcepts.get(cui);
	            if (sourceConcept != null)
	            	concept.setSourceConcepts(sourceConcept);
	            List<UmlsConcept> hypernym = hypernyms.get(cui);
	            if (hypernym != null)
	            	concept.setHypernyms(hypernym);
	            List<UmlsConcept> hyponym = hyponyms.get(cui);
	            if (hyponym != null)
	                concept.setHyponyms(hyponym);
	            concepts.add(concept);
	        }
	        logger.debug("Found source concepts " + concepts.size());

	        return concepts;
		}
	}
}
