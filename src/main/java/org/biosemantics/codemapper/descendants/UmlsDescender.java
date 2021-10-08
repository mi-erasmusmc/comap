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
import java.util.Map;

import javax.sql.DataSource;

import org.biosemantics.codemapper.CodeMapperException;
import org.biosemantics.codemapper.SourceConcept;
import org.biosemantics.codemapper.descendants.DescendersApi.GeneralDescender;

import com.mchange.v2.c3p0.DataSources;

public class UmlsDescender implements GeneralDescender {
   
	private DataSource connectionPool;
	
	public UmlsDescender(DataSource connectionPool) {
		this.connectionPool = connectionPool;
	}

	public Map<String, Collection<SourceConcept>> 
	getDescendants(Collection<String> codes, String codingSystem) 
			throws CodeMapperException {

		Map<String, Collection<SourceConcept>> result = new HashMap<>();

		// SQL function defined in src/main/resources/umls-functions.sql
		String query = "SELECT DISTINCT code0, code, str FROM descendant_codes(?, ?) WHERE code0 != code";

		try (Connection connection = connectionPool.getConnection();
		     PreparedStatement statement = connection.prepareStatement(query)) {
			Array array = connection.createArrayOf("VARCHAR", codes.toArray());

			int offset = 1;
			statement.setString(offset++, codingSystem);
			statement.setArray(offset++, array);
			
			ResultSet set = statement.executeQuery();
			while (set.next()) {
				String code0 = set.getString(1);
				String code = set.getString(2);
				String str = set.getString(3);
				
				SourceConcept concept = new SourceConcept();
				concept.setId(code);
				concept.setPreferredTerm(str);
				concept.setCodingSystem(codingSystem);
				
				if (!result.containsKey(code0)) {
					result.put(code0, new HashSet<SourceConcept>());
				}
				result.get(code0).add(concept);
			}
		} catch (SQLException e) {
			throw CodeMapperException.server("Cannot execute query for descendents", e);
		}
		return result;
	}
	
	public static void main(String[] args) throws SQLException, CodeMapperException {
		DataSource connectionPool = 
				DataSources.unpooledDataSource(
						"jdbc:postgresql://127.0.0.1/umls2021aa", 
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
