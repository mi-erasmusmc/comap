package org.biosemantics.codemapper.umls_ext;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Arrays;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.Iterator;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;

import javax.sql.DataSource;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.biosemantics.codemapper.CodeMapperException;
import org.biosemantics.codemapper.CodingSystem;
import org.biosemantics.codemapper.SourceConcept;
import org.biosemantics.codemapper.Utils;

public class Icd10AnyCodingSystem implements ExtCodingSystem {

    private static Logger logger = LogManager.getLogger(Icd10AnyCodingSystem.class);

    public final String ABBREVIATION = "ICD10/CM";
    public final String NAME = "Combination of ICD10CM and ICD10";
    public final String FAMILY = "ICD-10";

    private DataSource connectionPool;

    public Icd10AnyCodingSystem(DataSource connectionPool) {
        this.connectionPool = connectionPool;
    }

    @Override
    public CodingSystem getCodingSystem() {
        return new CodingSystem(ABBREVIATION, NAME, FAMILY);
    }

    @Override
    public Collection<String> getReferenceCodingSystems() {
        return Arrays.asList("ICD10", "ICD10CM");
    }

    @Override
    public Map<String, Map<String, List<SourceConcept>>> mapCodes(Map<String, List<SourceConcept>> codes) throws CodeMapperException {
        Map<String, Map<String, List<SourceConcept>>> res = new HashMap<>();
        for (String cui : codes.keySet()) {
            Map<String, List<SourceConcept>> map = new HashMap<String, List<SourceConcept>>();
            for (SourceConcept sourceConcept : codes.get(cui)) {
                String id = sourceConcept.getId();
                if (!map.containsKey(id) || "ICD10".equals(sourceConcept.getCodingSystem())) {
                    SourceConcept sourceConcept2 = new SourceConcept(cui, ABBREVIATION, id, sourceConcept.getPreferredTerm());
                    System.out.println(sourceConcept.toString());
                    map.put(id, Collections.singletonList(sourceConcept2));
                }
            }
            res.put(cui, map);
        }
        return res;
    }
    
    @Override
    public List<String> getKnownCodes(List<String> codes) throws CodeMapperException {
        String queryFmt = "SELECT DISTINCT `code` FROM `MRCONSO` WHERE `code` IN (%s) and SAB in (%s)";
        Collection<String> sabs = getReferenceCodingSystems();
        String query = String.format(queryFmt, Utils.sqlPlaceholders(codes.size()), Utils.sqlPlaceholders(sabs.size()));
        System.out.println(query);
        try (Connection connection = connectionPool.getConnection();
                PreparedStatement statement = connection.prepareStatement(query)) {
            System.out.println(statement);
            int offset = 1;
            for (Iterator<String> iter = codes.iterator(); iter.hasNext(); offset++)
                statement.setString(offset, iter.next());
            for (Iterator<String> iter = sabs.iterator(); iter.hasNext(); offset++)
                statement.setString(offset, iter.next());
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

    @Override
    public List<String> getCuisForCodes(List<String> codes) throws CodeMapperException {
        if (codes == null || codes.isEmpty())
            return new LinkedList<>();
        Collection<String> sabs = getReferenceCodingSystems();
        String queryFmt = "SELECT DISTINCT `cui` FROM `MRCONSO` WHERE `code` IN (%s) and `sab` IN (%s)";
        String query = String.format(queryFmt, Utils.sqlPlaceholders(codes.size()), Utils.sqlPlaceholders(sabs.size()));
        try (Connection connection = connectionPool.getConnection();
                PreparedStatement statement = connection.prepareStatement(query)) {
            int offset = 1;
            for (Iterator<String> iter = codes.iterator(); iter.hasNext(); offset++)
                statement.setString(offset, iter.next());
            for (Iterator<String> iter = sabs.iterator(); iter.hasNext(); offset++)
                statement.setString(offset, iter.next());
            logger.debug(statement);
            ResultSet result = statement.executeQuery();
            List<String> cuis= new LinkedList<>();
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
