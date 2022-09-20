package org.biosemantics.codemapper.descendants;

import java.sql.Array;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Arrays;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.Map;

import javax.sql.DataSource;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.biosemantics.codemapper.CodeMapperException;
import org.biosemantics.codemapper.SourceConcept;
import org.biosemantics.codemapper.descendants.DescendersApi.GeneralDescender;

import com.mchange.v2.c3p0.DataSources;

public class UmlsDescender implements GeneralDescender {

	private static Logger logger = LogManager.getLogger(UmlsDescender.class);

	private DataSource connectionPool;

	public UmlsDescender(DataSource connectionPool) {
		this.connectionPool = connectionPool;
	}

	public static Collection<String> concat(Collection<Collection<String>> sss) {
		Collection<String> res = new HashSet<>();
		for (Collection<String> ss : sss) {
			res.addAll(ss);
		}
		return res;
	}

	public Map<String, Collection<SourceConcept>> getDescendants(Collection<String> codes, String codingSystem)
			throws CodeMapperException {
		// {code -> {aui}}
		Map<String, Collection<String>> auis = getAuis(codingSystem, codes);

		// {aui -> {aui}}
		Map<String, Collection<String>> descendantAuis = getDescendantAuis(concat(auis.values()));

		// {aui -> SourceConcept}
		Map<String, SourceConcept> concepts = getConcepts(connectionPool, concat(descendantAuis.values()));

		// {code -> {SourceConcept}}
		Map<String, Collection<SourceConcept>> res = new HashMap<>();
		for (String code : codes) {
			Collection<SourceConcept> sourceConcepts = new LinkedList<>();
			if (!auis.containsKey(code)) {
				continue;
			}
			for (String superAui : auis.get(code)) {
				if (!descendantAuis.containsKey(superAui)) {
					continue;
				}
				for (String subAui : descendantAuis.get(superAui)) {
					if (!concepts.containsKey(subAui)) {
						continue;
					}
					sourceConcepts.add(concepts.get(subAui));
				}
			}
			res.put(code, sourceConcepts);
		}
		return res;
	}

	/** Returns a mapping from codes to sets of auis. */
	private Map<String, Collection<String>> getAuis(String codingSystem, Collection<String> codes)
			throws CodeMapperException {
		String query = //
				"SELECT DISTINCT code, aui FROM mrconso "
				+ "WHERE sab = ? AND code = ANY(?)";

		try (Connection connection = connectionPool.getConnection();
				PreparedStatement statement = connection.prepareStatement(query)) {
			statement.setString(1, codingSystem);
			Array array = connection.createArrayOf("VARCHAR", codes.toArray());
			statement.setArray(2, array);
			
			logger.debug(statement);
			ResultSet set = statement.executeQuery();

			Map<String, Collection<String>> res = new HashMap<>();
			while (set.next()) {
				String code = set.getString(1);
				String aui = set.getString(2);
				if (!res.containsKey(code)) {
					res.put(code, new HashSet<>());
				}
				res.get(code).add(aui);
			}
			return res;
		} catch (SQLException e) {
			throw CodeMapperException.server("Cannot execute query for decendant auis", e);
		}
	}

	/** Returns a mapping from super auis to sets of descendant auis. */
	public Map<String, Collection<String>> getDescendantAuis(Collection<String> auis) throws CodeMapperException {
		if (auis.isEmpty()) {
			return new HashMap<>();
		}
		
		String queryFmt = //
				"WITH RECURSIVE descendants AS (\n" 
				+ "    SELECT * FROM (VALUES %s) AS t(path)\n"
				+ "  UNION\n" + "      SELECT * FROM (\n"
				+ "      WITH descendants_inner AS ( SELECT * FROM descendants )\n"
				+ "        SELECT DISTINCT ds.path || r.aui2\n"
				+ "        FROM descendants_inner ds INNER JOIN mrrel r\n"
				+ "        ON ds.path[array_upper(ds.path, 1)] = r.aui1\n"
				+ "        WHERE r.rel = 'CHD' AND r.aui2 IS NOT NULL AND r.aui2 != r.aui1\n" 
				+ "      UNION\n"
				+ "        SELECT DISTINCT ds.path || r.aui1\n"
				+ "        FROM descendants_inner ds INNER JOIN mrrel r\n"
				+ "        ON ds.path[array_upper(ds.path, 1)] = r.aui2\n"
				+ "        WHERE r.rel = 'PAR' AND r.aui1 IS NOT NULL AND r.aui1 != r.aui2\n" 
				+ "  ) t\n" 
				+ ")\n"
				+ "SELECT DISTINCT ds.path FROM descendants ds;\n" + "";
		// apparently we can't use PreparedStatement.setString in values, so doing it
		// manually here
		StringBuffer buf = new StringBuffer();
		for (String aui : auis) {
			if (buf.length() > 0) {
				buf.append(", ");
			}
			buf.append(String.format("('{\"%s\"}'::varchar[])", aui));
		}
		String query = String.format(queryFmt, buf);

		try (Connection connection = connectionPool.getConnection();
				PreparedStatement statement = connection.prepareStatement(query)) {

			logger.debug(statement);
			ResultSet set = statement.executeQuery();

			Map<String, Collection<String>> descendants = new HashMap<>();
			while (set.next()) {
				String[] arr = (String[]) set.getArray(1).getArray();
				if (arr.length > 1) {
					String superId = arr[0];
					String subId = arr[arr.length - 1];
					if (!descendants.containsKey(superId)) {
						descendants.put(superId, new HashSet<>());
					}
					descendants.get(superId).add(subId);
				}
			}
			return descendants;
		} catch (SQLException e) {
			throw CodeMapperException.server("Cannot execute query for descendants", e);
		}
	}

	public static Map<String, SourceConcept> getConcepts(DataSource connectionPool, Collection<String> auis) throws CodeMapperException {
		String query = //
				"SELECT DISTINCT aui, code, str, ispref "
				+ "FROM mrconso WHERE aui = ANY(?)";

		try (Connection connection = connectionPool.getConnection();
				PreparedStatement statement = connection.prepareStatement(query)) {

			Array array = connection.createArrayOf("VARCHAR", auis.toArray());
			statement.setArray(1, array);

			logger.debug(statement);
			ResultSet set = statement.executeQuery();

			Map<String, SourceConcept> res = new HashMap<>();
			while (set.next()) {
				String aui = set.getString(1);
				String code = set.getString(2);
				String str = set.getString(3);
				boolean ispref = set.getString(4).equals("Y");
				if (!res.containsKey(aui) || ispref) {
					SourceConcept concept = new SourceConcept();
					concept.setId(code);
					concept.setPreferredTerm(str);
					res.put(aui, concept);
				}
			}
			return res;
		} catch (SQLException e) {
			throw CodeMapperException.server("Cannot execute query for descendant concepts", e);
		}
	}

	public static void main(String[] args) throws SQLException, CodeMapperException {
		DataSource connectionPool = DataSources.unpooledDataSource("jdbc:postgresql://127.0.0.1/umls2021aa",
				"codemapper", "codemapper");
		UmlsDescender descender = new UmlsDescender(connectionPool);
		Map<String, Collection<SourceConcept>> map = descender.getDescendants(Arrays.asList("U07"), "ICD10CM");
		for (Collection<SourceConcept> set : map.values()) {
			for (SourceConcept c : set) {
				System.out.println("- " + c);
			}
		}
	}
}
