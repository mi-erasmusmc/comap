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
 * @author benus
 *
 */
public class UmlsApiDatabase implements UmlsApi {

	private final List<String> languages = null;
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

		String query = "SELECT DISTINCT rsab, son, sf FROM MRSAB";
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

				System.out.println(statement);
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

	public Map<String, UmlsConcept> getConceptsWithTerms(List<String> cuis, List<String> vocabularies)
			throws CodeMapperException {

		if (vocabularies == null)
			vocabularies = availableVocabularies;

		String cuisPlaceholders = placeholders(cuis.size());

		String sabPlaceholders;
		if (vocabularies != null)
			sabPlaceholders = String.format("AND sab IN (%s)", placeholders(vocabularies.size()));
		else
			sabPlaceholders = "";

		String latPlaceholders;
		if (languages != null)
			latPlaceholders = String.format("AND lat IN (%s)", placeholders(languages.size()));
		else
			latPlaceholders = "";

		String queryFmt = "SELECT DISTINCT cui, sab, code, str, tty FROM MRCONSO "
				+ "WHERE cui IN (%s) %s %s ORDER BY cui, sab, code, str";
		String query = String.format(queryFmt, cuisPlaceholders, sabPlaceholders, latPlaceholders);

		try (PreparedStatement statement = getConnection().prepareStatement(query)) {

			int offset = 1;
			for (int ix = 0; ix < cuis.size(); ix++, offset++)
				statement.setString(offset, cuis.get(ix));
			if (vocabularies != null)
				for (int ix = 0; ix < vocabularies.size(); ix++, offset++)
					statement.setString(offset, vocabularies.get(ix));
			if (languages != null)
				for (int ix = 0; ix < languages.size(); ix++, offset++)
					statement.setString(offset, languages.get(ix));

			System.out.println(statement);
			ResultSet result = statement.executeQuery();

			Map<String, UmlsConcept> concepts = new TreeMap<>();
			String lastCui = null, lastSab = null, lastCode = null;
			UmlsConcept currentConcept = null;
			SourceConcept currentSourceConcept = null;
			while (result.next()) {
				String cui = result.getString(1);
				String sab = result.getString(2);
				String code = result.getString(3);
				String str = result.getString(4);
				String tty = result.getString(5);
				if (!cui.equals(lastCui)) {
					currentConcept = new UmlsConcept();
					currentConcept.setCui(cui);
					concepts.put(cui, currentConcept);
				}
				if (!cui.equals(lastCui) || !sab.equals(lastSab) || !code.equals(lastCode)) {
					currentSourceConcept = new SourceConcept();
					currentSourceConcept.setCui(cui);
					currentSourceConcept.setVocabulary(sab);
					currentSourceConcept.setId(code);
					currentSourceConcept.setPreferredTerm(str);
					currentConcept.getSourceConcepts().add(currentSourceConcept);
				}
				if ("PT".equals(tty))
					currentSourceConcept.setPreferredTerm(str);
				currentSourceConcept.getTerms().add(str);
				lastCui = cui;
				lastSab = sab;
				lastCode = code;
			}

			Set<String> missings = new TreeSet<>(cuis);
			missings.removeAll(concepts.keySet());
			for (String missing : missings)
				logger.warn("No UMLS concept found for CUI " + missing);
			return concepts;
		} catch (SQLException e) {
			throw new CodeMapperException(e);
		}
	}

	private Map<String, List<UmlsConcept>> getHyponyms(List<String> cuis) throws CodeMapperException {
		String queryFmt = "SELECT DISTINCT cui1, cui2 "
				+ "FROM MRREL "
				+ "WHERE rel in ('RN', 'CHD') "
				+ "AND cui1 IN (%s) "
				+ "AND cui1 != cui2"
				+ "AND (rela IS NULL OR rela = 'isa')";
		String query = String.format(queryFmt, placeholders(cuis.size()));

		try (PreparedStatement statement = getConnection().prepareStatement(query)) {

			int offset = 1;
			for (int ix = 0; ix < cuis.size(); ix++, offset++)
				statement.setString(offset, cuis.get(ix));

			System.out.println(statement);
			ResultSet result = statement.executeQuery();

			Map<String, Set<String>> hyponymCuis = new TreeMap<>();
			while (result.next()) {
				String cui1 = result.getString(1);
				String cui2 = result.getString(2);
				if (!hyponymCuis.containsKey(cui1))
					hyponymCuis.put(cui1, new TreeSet<String>());
				hyponymCuis.get(cui1).add(cui2);
			}

			List<String> hyponymCuisList = new LinkedList<>();
			for (Collection<String> cs : hyponymCuis.values())
				hyponymCuisList.addAll(cs);
			Map<String, String> names = getPreferredNames(hyponymCuisList);

			Map<String, List<UmlsConcept>> hyponyms = new TreeMap<>();
			for (String cui : cuis)
				if (hyponymCuis.containsKey(cui)) {
					List<UmlsConcept> concepts = new LinkedList<>();
					for (String hyponym : hyponymCuis.get(cui))
						concepts.add(new UmlsConcept(hyponym, names.get(hyponym)));
					hyponyms.put(cui, concepts);
				}
			return hyponyms;
		} catch (SQLException e) {
			throw new CodeMapperException(e);
		}
	}

	private Map<String, String> getDefinitions(List<String> cuis) throws CodeMapperException {
		String queryFmt = "SELECT DISTINCT　cui, sab, def " + "FROM MRDEF " + "WHERE cui IN (%s)";
		String query = String.format(queryFmt, placeholders(cuis.size()));
		try (PreparedStatement statement = getConnection().prepareStatement(query)) {

			int offset = 1;
			for (int ix = 0; ix < cuis.size(); ix++, offset++)
				statement.setString(offset, cuis.get(ix));

			System.out.println(statement);
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

	@Override
	public List<UmlsConcept> getConcepts(List<String> cuis, List<String> vocabularies, List<String> expand)
			throws CodeMapperException {

		Map<String, UmlsConcept> concepts = getConceptsWithTerms(cuis, vocabularies);
		System.out.println("Found concepts " + concepts.size());

		Map<String, String> preferredNames = getPreferredNames(cuis);
		for (String cui : cuis)
			if (concepts.keySet().contains(cui) && preferredNames.containsKey(cui))
				concepts.get(cui).setPreferredName(preferredNames.get(cui));

		Map<String, List<UmlsConcept>> hyponyms = getHyponyms(cuis);
		for (String cui : cuis)
			if (concepts.keySet().contains(cui) && hyponyms.containsKey(cui))
				concepts.get(cui).setHyponyms(hyponyms.get(cui));

		Map<String, String> definitions = getDefinitions(cuis);
		for (String cui : cuis)
			if (concepts.keySet().contains(cui) && definitions.containsKey(cui))
				concepts.get(cui).setDefinition(definitions.get(cui));

		return new LinkedList<>(concepts.values());
	}
}
