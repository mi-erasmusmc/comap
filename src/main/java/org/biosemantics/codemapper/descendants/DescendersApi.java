package org.biosemantics.codemapper.descendants;

import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.stream.Collectors;
import org.biosemantics.codemapper.CodeMapperException;
import org.biosemantics.codemapper.MappingData.Code;
import org.biosemantics.codemapper.SourceConcept;
import org.biosemantics.codemapper.rest.NonUmlsTargets;

public class DescendersApi {

  public static interface SpecificDescender {

    /** Returns the coding system for which the specific descender retrieves codes */
    public String getCodingSystem();

    /** Returns a mapping of each of the argument codes to a collection of descendant codes. */
    public Map<String, Collection<SourceConcept>> getDescendants(Collection<String> codes)
        throws CodeMapperException;
  }

  public static interface GeneralDescender {

    /** Returns a mapping of each of the argument codes to a collection of descendant codes. */
    public Map<String, Collection<SourceConcept>> getDescendants(
        Collection<String> codes, String codingSystem) throws CodeMapperException;
  }

  Map<String, SpecificDescender> specificDescenders;
  GeneralDescender generalDescender;
  NonUmlsTargets nonUmls;

  public DescendersApi(GeneralDescender generalDescender, NonUmlsTargets nonUmls) {
    this.generalDescender = generalDescender;
    this.specificDescenders = new HashMap<>();
    this.nonUmls = nonUmls;
  }

  public void add(SpecificDescender specificDescender) {
    this.specificDescenders.put(specificDescender.getCodingSystem(), specificDescender);
  }

  /* Returns map from root codes to descendant source concepts */
  public HashMap<String, Collection<SourceConcept>> getCodeDescendants(
      String codingSystem, Collection<String> codes) throws CodeMapperException {
    HashMap<String, Collection<SourceConcept>> res = new HashMap<>();
    if (specificDescenders.containsKey(codingSystem)) {
      Map<String, Collection<SourceConcept>> descendants2 =
          specificDescenders.get(codingSystem).getDescendants(codes);
      for (String code : descendants2.keySet()) {
        res.merge(
            code,
            descendants2.get(code),
            (v1, v2) -> {
              v1.addAll(v2);
              return v1;
            });
      }
    } else if (nonUmls.is(codingSystem)) {
      Map<String, Collection<String>> cuisByCodes = nonUmls.getCuisForCodes(codingSystem, codes);
      Collection<String> cuis = new HashSet<>();
      for (Collection<String> cuis1 : cuisByCodes.values()) {
        cuis.addAll(cuis1);
      }
      Map<String, Collection<Code>> descsByCui = nonUmls.getDescendants(cuis, codingSystem);
      for (String code : cuisByCodes.keySet()) {
        for (String cui : cuisByCodes.get(code)) {
          Collection<SourceConcept> descs =
              descsByCui.getOrDefault(cui, Collections.emptyList()).stream()
                  .map((c) -> c.toSourceConcept(cui, codingSystem))
                  .collect(Collectors.toList());
          if (descs == null) {
            continue;
          }
          res.computeIfAbsent(code, (key) -> new HashSet<>()).addAll(descs);
        }
      }

    } else {
      Map<String, Collection<SourceConcept>> descendants2 =
          generalDescender.getDescendants(codes, codingSystem);
      for (String code : descendants2.keySet()) {
        res.merge(
            code,
            descendants2.get(code),
            (v1, v2) -> {
              v1.addAll(v2);
              return v1;
            });
      }
    }
    return res;
  }

  /* Map coding system to root code to descendant source concept */
  public static class Descendants extends HashMap<String, Map<String, Collection<SourceConcept>>> {
    private static final long serialVersionUID = 1L;
  }

  public Descendants getDescendants(Map<String, Map<String, Code>> codesByVoc)
      throws CodeMapperException {
    Map<String, Collection<String>> codes = new HashMap<>();
    for (String voc : codesByVoc.keySet()) {
      codes.put(voc, codesByVoc.get(voc).keySet());
    }
    return getDescendantCodes(codes);
  }

  public Descendants getDescendantCodes(Map<String, Collection<String>> codesByVoc)
      throws CodeMapperException {
    Descendants descendants = new Descendants();
    for (String codingSystem : codesByVoc.keySet()) {
      Collection<String> codes = codesByVoc.get(codingSystem);
      descendants.put(codingSystem, getCodeDescendants(codingSystem, codes));
    }
    return descendants;
  }
}
