package nl.erasmusmc.mieur.biosemantics.advance.codemapper.api;

import gov.nih.nlm.umls.uts.webservice.AtomDTO;
import gov.nih.nlm.umls.uts.webservice.ConceptDTO;
import gov.nih.nlm.umls.uts.webservice.ConceptRelationDTO;
import gov.nih.nlm.umls.uts.webservice.DefinitionDTO;
import gov.nih.nlm.umls.uts.webservice.Psf;
import gov.nih.nlm.umls.uts.webservice.RootSourceDTO;
import gov.nih.nlm.umls.uts.webservice.UtsFault_Exception;
import gov.nih.nlm.umls.uts.webservice.UtsWsContentController;
import gov.nih.nlm.umls.uts.webservice.UtsWsContentControllerImplService;
import gov.nih.nlm.umls.uts.webservice.UtsWsMetadataController;
import gov.nih.nlm.umls.uts.webservice.UtsWsMetadataControllerImplService;
import gov.nih.nlm.umls.uts.webservice.UtsWsSecurityController;
import gov.nih.nlm.umls.uts.webservice.UtsWsSecurityControllerImplService;

import java.util.ArrayList;
import java.util.TreeMap;
import java.util.List;
import java.util.Map;

import nl.erasmusmc.mieur.biosemantics.advance.codemapper.CodingSystem;
import nl.erasmusmc.mieur.biosemantics.advance.codemapper.SourceConcept;
import nl.erasmusmc.mieur.biosemantics.advance.codemapper.UmlsConcept;

import org.apache.log4j.Logger;

/**
 * UTF based implementation of the UMLS API used for the code mapper.
 *
 * @author benus
 *
 */
public class UmlsApiUtf implements UmlsApi {

	private UtsWsContentController contentService;
	private UtsWsSecurityController securityService;
	private UtsWsMetadataController metaService;
	private String ticketGrantingTicket;
	private String serviceName;
	private String version;
	private List<String> availableVocabularies;
	private List<String> vocabulariesWithDefinition;
	private String username;
	private String password;

	private static Logger logger = Logger.getLogger("AdvanceCodeMapper");

	public UmlsApiUtf(String serviceName, String version, String username, String password,
			List<String> availableVocabularies, List<String> vocabulariesWithDefinition) {

		logger.info(String.format(
				"Umls API init service name %s version %s username %s password %s availableVocabularies %d",
				serviceName, version, username, password, availableVocabularies.size()));

		this.username = username;
		this.password = password;
		this.serviceName = serviceName;
		this.version = version;
		this.availableVocabularies = availableVocabularies;
		this.vocabulariesWithDefinition = vocabulariesWithDefinition;

		this.securityService = new UtsWsSecurityControllerImplService().getUtsWsSecurityControllerImplPort();
		this.contentService = new UtsWsContentControllerImplService().getUtsWsContentControllerImplPort();
		this.metaService = new UtsWsMetadataControllerImplService().getUtsWsMetadataControllerImplPort();

	}

	private String tick() throws UtsFault_Exception {
		if (ticketGrantingTicket == null)
			ticketGrantingTicket = securityService.getProxyGrantTicket(username, password);
		try {
			return securityService.getProxyTicket(ticketGrantingTicket, serviceName);
		} catch (UtsFault_Exception e) {
			ticketGrantingTicket = securityService.getProxyGrantTicket(username, password);
			return securityService.getProxyTicket(ticketGrantingTicket, serviceName);
		}
	}

	/*
	 * (non-Javadoc)
	 *
	 * @see nl.erasmusmc.mieur.biosemantics.advance.codemapper.UmlsApiInterface#
	 * getUmlsConcepts(java.util.List, java.util.List, java.util.List)
	 */
	@Override
	public List<UmlsConcept> getConcepts(List<String> cuis, List<String> vocabularies)
			throws CodeMapperException {
		Psf psf = new Psf();
		psf.getIncludedSources().addAll(vocabularies);
		List<UmlsConcept> result = new ArrayList<UmlsConcept>();
		for (String cui : cuis) {
			ConceptDTO concept;
			try {
				concept = contentService.getConcept(tick(), version, cui);
				if (concept == null)
					throw new CodeMapperException("Not a CUI: " + cui);
				List<String> semanticTypes = concept.getSemanticTypes();
				Map<String, DefinitionDTO> definitions = new TreeMap<>();
				String definition = null;
				{
					for (DefinitionDTO d : contentService.getConceptDefinitions(tick(), version, cui, new Psf()))
						definitions.put(d.getRootSource(), d);
					for (String voc : vocabulariesWithDefinition)
						if (definitions.containsKey(voc)) {
							definition = definitions.get(voc).getValue();
							break;
						}
				}
				String preferredName = concept.getDefaultPreferredName();
				// vocabulary -> code -> sourceConcept
				Map<String, Map<String, SourceConcept>> sourceConceptsByVocabulary = new TreeMap<>();
				List<AtomDTO> atoms = contentService.getConceptAtoms(tick(), version, cui, psf);
				for (AtomDTO atom : atoms) {
					String vocabulary = atom.getRootSource();
					if (!sourceConceptsByVocabulary.containsKey(vocabulary))
						sourceConceptsByVocabulary.put(vocabulary, new TreeMap<String, SourceConcept>());
					Map<String, SourceConcept> sourceConcepts = sourceConceptsByVocabulary.get(vocabulary);
					String id = atom.getCode().getUi();
					if (!sourceConcepts.containsKey(id)) {
						SourceConcept sourceConcept = new SourceConcept(cui, vocabulary, id);
						sourceConcepts.put(id, sourceConcept);
					}
					SourceConcept sourceConcept = sourceConcepts.get(id);
					String term = atom.getTermString().getName();
					if ("PT".equals(atom.getTermType()) || sourceConcept.getPreferredTerm() == null)
						sourceConcept.setPreferredTerm(term);
					sourceConcept.getTerms().add(term);
				}

				List<UmlsConcept> hyponyms = new ArrayList<>();
				{
					List<ConceptRelationDTO> relations = contentService.getConceptConceptRelations(tick(), version,
							cui, new Psf());
					for (ConceptRelationDTO relation : relations)
						if ("RB".equals(relation.getRelationLabel())) {
							ConceptDTO hyponymDTO = relation.getRelatedConcept();
							UmlsConcept hyponym = new UmlsConcept(hyponymDTO.getUi(),
									hyponymDTO.getDefaultPreferredName());
							hyponyms.add(hyponym);
						}
				}

				List<SourceConcept> sourceConcepts = new ArrayList<>();
				for (Map<String, SourceConcept> m : sourceConceptsByVocabulary.values())
					sourceConcepts.addAll(m.values());
				UmlsConcept umlsConcept = new UmlsConcept(cui, preferredName, definition, semanticTypes,
						sourceConcepts, hyponyms);
				result.add(umlsConcept);
			} catch (UtsFault_Exception e) {
				throw new CodeMapperException("Couldn't retrieve concept of CUI " + cui, e);
			}
		}
		return result;
	}

	private static Map<String, CodingSystem> codingSystemsMap = null;

	public Map<String, CodingSystem> getCodingSystemsMap() throws CodeMapperException {
		if (codingSystemsMap == null) {
			codingSystemsMap = new TreeMap<String, CodingSystem>();
			try {
				List<RootSourceDTO> rootSources = metaService.getAllRootSources(tick(), version);
				for (RootSourceDTO rootSource : rootSources) {
					String abbrevation = rootSource.getAbbreviation();
					String name = rootSource.getPreferredName();
					String family = rootSource.getFamily();
					if (availableVocabularies.contains(abbrevation))
						codingSystemsMap.put(abbrevation, new CodingSystem(abbrevation, name, family));
				}
			} catch (UtsFault_Exception e) {
				throw new CodeMapperException("Couldn't receive all root sources", e);
			}
		}
		return codingSystemsMap;
	}

	/*
	 * (non-Javadoc)
	 *
	 * @see nl.erasmusmc.mieur.biosemantics.advance.codemapper.UmlsApiInterface#
	 * getCodingSystems()
	 */
	@Override
	public List<CodingSystem> getCodingSystems() throws CodeMapperException {
		return new ArrayList<CodingSystem>(getCodingSystemsMap().values());
	}
}
