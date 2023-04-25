package org.biosemantics.codemapper.rest;

import java.sql.Array;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.Map;

import javax.sql.DataSource;

import org.biosemantics.codemapper.CodeMapperException;
import org.biosemantics.codemapper.SourceConcept;
import org.biosemantics.codemapper.descendants.DescendersApi.SpecificDescender;
import org.biosemantics.codemapper.descendants.UmlsDescender;

public class UmlsTCDescender implements SpecificDescender {

	private final String codingSystem;
	private final DataSource dataSource;

	public UmlsTCDescender(String codingSystem, DataSource dataSource) {
		this.codingSystem = codingSystem;
		this.dataSource = dataSource;
	}

	@Override
	public String getCodingSystem() {
		return codingSystem;
	}

	@Override
	public Map<String, Collection<SourceConcept>> getDescendants(Collection<String> codes) throws CodeMapperException {
		try {
			// {code -> {aui}}
			Map<String, Collection<String>> auis = getAuis(codes);
			// {aui -> {aui}}
			Map<String, Collection<String>> subAuis = getDescendantAuis(UmlsDescender.concat(auis.values()));
			// {aui -> SourceConcept}
			Map<String, SourceConcept> sourceConcepts = UmlsDescender.getConcepts(dataSource, UmlsDescender.concat(subAuis.values()));
			// {code -> {SourceConcept}}
			Map<String, Collection<SourceConcept>> res = new HashMap<>();
			for (String code: codes) {
				Collection<SourceConcept> subConcepts = new LinkedList<>();
				for (String auiSup: auis.getOrDefault(code, Collections.emptySet())) {
					for (String auiSub: subAuis.getOrDefault(auiSup, Collections.emptySet())) {
						subConcepts.add(sourceConcepts.get(auiSub));
					}
				}
				res.put(code, subConcepts);
			}
			return res;
		} catch (SQLException e) {
			throw CodeMapperException.server("Cannot collect UMLS TC descendents", e);
		}
	}

	private Map<String, Collection<String>> getAuis(Collection<String> codes) throws SQLException {
		String query = "SELECT code, aui FROM mrconso WHERE sab = ? AND code = ANY(?)";

		Connection connection = dataSource.getConnection();
		PreparedStatement statement = connection.prepareStatement(query);
		statement.setString(1, codingSystem);
		Array codesArray = connection.createArrayOf("VARCHAR", codes.toArray());
		statement.setArray(2, codesArray);
		
		Map<String, Collection<String>> res = new HashMap<>();
		ResultSet resultSet = statement.executeQuery();
		while (resultSet.next()) {
			String code = resultSet.getString(1);
			String aui = resultSet.getString(2);
			if (!res.containsKey(code)) {
				res.put(code, new HashSet<>());
			}
			res.get(code).add(aui);
		}
		return res;
	}

	private Map<String, Collection<String>> getDescendantAuis(Collection<String> auis) throws SQLException {
		String query = "SELECT sup, sub FROM transitiveclosure WHERE sup = ANY(?)";
		Connection connection = dataSource.getConnection();
		PreparedStatement statement = connection.prepareStatement(query);
		Array codesArray = connection.createArrayOf("VARCHAR", auis.toArray());
		statement.setArray(1, codesArray);

		Map<String, Collection<String>> res = new HashMap<>();
		ResultSet resultSet = statement.executeQuery();
		while (resultSet.next()) {
			String sup = resultSet.getString(1);
			String sub = resultSet.getString(2);
			if (!res.containsKey(sup)) {
				res.put(sup, new HashSet<>());
			}
			res.get(sup).add(sub);
		}
		return res;
	}
}
