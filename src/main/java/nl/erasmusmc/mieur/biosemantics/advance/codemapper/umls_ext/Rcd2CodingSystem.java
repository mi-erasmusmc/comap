package nl.erasmusmc.mieur.biosemantics.advance.codemapper.umls_ext;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.Set;

import nl.erasmusmc.mieur.biosemantics.advance.codemapper.CodeMapperException;
import nl.erasmusmc.mieur.biosemantics.advance.codemapper.CodingSystem;
import nl.erasmusmc.mieur.biosemantics.advance.codemapper.SourceConcept;
import nl.erasmusmc.mieur.biosemantics.advance.codemapper.Utils;

public class Rcd2CodingSystem implements ExtCodingSystem {

	public final String ABBREVIATION = "RCD2";
	public final String NAME = "Read thesaurus, version 2";
	public final String FAMILY = "Read thesaurus, version 2";

	public final String QUERY_FMT =
			"SELECT DISTINCT CTV3_CONCEPTID, V2_CONCEPTID FROM RCD_V3_to_V2 "
			// Make CTV3_CONCEPTID case sensitive!
			+ "WHERE CAST(CTV3_CONCEPTID AS CHAR CHARACTER SET latin1) COLLATE latin1_general_cs IN (%s) "
			+ "AND V2_CONCEPTID NOT IN ('_DRUG', '_NONE')";

	private String uri;
	private Properties connectionProperties;
	private Connection connection;

	public Rcd2CodingSystem(String uri, Properties connectionProperties) {
		this.uri = uri;
		this.connectionProperties = connectionProperties;
	}

	private Connection getConnection() throws SQLException {
		if (connection == null || connection.isClosed())
			connection = DriverManager.getConnection(uri, connectionProperties);
		return connection;
	}

	@Override
	public CodingSystem getCodingSystem() {
		return new CodingSystem(ABBREVIATION, NAME, FAMILY);
	}

	@Override
	public String getReferenceCodingSystem() {
		return "RCD";
	}

	@Override
	public Map<String, Map<String, List<SourceConcept>>> mapCodes(Map<String, List<SourceConcept>> referenceCodes) throws CodeMapperException {

		if (referenceCodes.isEmpty())
			return new HashMap<>();

		/** referenceCodes {CUI: [SourceConcept3]} */

		Set<String> codes = new HashSet<>();
		for (List<SourceConcept> referenceCodesForCui: referenceCodes.values())
			for (SourceConcept referenceCode: referenceCodesForCui)
				codes.add(referenceCode.getId());

		String query = String.format(QUERY_FMT, Utils.sqlPlaceholders(codes.size()));
		try (PreparedStatement statement = getConnection().prepareStatement(query)) {
			int offset = 1;
			for (Iterator<String> iter = codes.iterator(); iter.hasNext(); offset++)
				statement.setString(offset, iter.next());

			ResultSet result = statement.executeQuery();

			// Create a mapping from RCD3 to RCD2 codes
			/** mapping: {Code3: [Code2]} */
			Map<String, List<String>> mapping = new HashMap<>();
			while (result.next()) {
				String codeRcd3 = result.getString(1);
				String codeRcd2 = result.getString(2);
				if (!mapping.containsKey(codeRcd3))
					mapping.put(codeRcd3, new LinkedList<String>());
				mapping.get(codeRcd3).add(codeRcd2);
			}

			/** res: {CUI: {Code3: [SourceConcept2]}} */
			Map<String, Map<String, List<SourceConcept>>> res = new HashMap<>();
			for (String cui: referenceCodes.keySet()) {
				res.put(cui, new HashMap<String, List<SourceConcept>>());
				for (SourceConcept sourceConceptRcd3: referenceCodes.get(cui)) {
					String code3 = sourceConceptRcd3.getId();
					List<SourceConcept> sourceConceptsRcd2 = new LinkedList<>();
					if (mapping.containsKey(code3))
						for (String code2: mapping.get(code3)) {
							String preferredTerm = null;
							SourceConcept sourceConcept2 = new SourceConcept(cui, ABBREVIATION, code2, preferredTerm);
							sourceConceptsRcd2.add(sourceConcept2);
						}
					if (!sourceConceptsRcd2.isEmpty())
						res.get(cui).put(code3, sourceConceptsRcd2);
				}
			}
			return res;
		} catch (SQLException e) {
			throw CodeMapperException.server("Cannot execute query to map from READ 3 to 2", e);
		}
	}
}