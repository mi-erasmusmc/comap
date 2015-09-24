from collections import defaultdict

class Concepts:

    def __init__(self, by_cuis=None):
        self._by_cuis = by_cuis or {}

    def to_data(self):
        return {
            cui: self._by_cuis[cui].to_data()
            for cui in self._by_cuis
        }

    @classmethod
    def of_data(cls, data):
        return Concepts({
            cui: CodesByCodingSystems.of_data(data[cui])
            for cui in data
        })

    @classmethod
    def of_raw_data(cls, data, semantic_types=None):
        return Concepts({
            concept['cui']: CodesByCodingSystems.of_raw_data(concept['sourceConcepts'])
            for concept in data
            if semantic_types is None or \
                set(concept['semanticTypes']) & set(semantic_types)
        })

    def filter_codes_in_dbs(self, codes_in_dbs):
        return Concepts({
            cui: self._by_cuis[cui].filter_codes_in_dbs(codes_in_dbs)
            for cui in self._by_cuis
        })

    def add(self, cui, for_cui):
        assert cui not in self._by_cuis
        self._by_cuis[cui] = for_cui

    def cuis(self):
        return list(self._by_cuis.keys())

    def cui(self, cui):
        """ Returns a CodesByCodingSystems """
        return self._by_cuis[cui]

    def codes(self, coding_system):
        codes = set()
        for cui in self._by_cuis:
            codes.update(self._by_cuis[cui].codes(coding_system))
        return codes
            

class CodesByCodingSystems:

    def __init__(self, by_coding_systems=None):
        self._by_coding_systems = by_coding_systems or {}

    @classmethod
    def of_data(cls, data):
        return CodesByCodingSystems({
            coding_system: set(data[coding_system])
            for coding_system in data
        })
            
    def to_data(self):
        return {
            coding_system: list(self._by_coding_systems[coding_system])
            for coding_system in self._by_coding_systems
        }

    @classmethod
    def of_raw_data(cls, source_concepts):
        by_coding_systems = {}
        for source_concept in source_concepts:
            coding_system = source_concept['codingSystem']
            if coding_system not in by_coding_systems:
                by_coding_systems[coding_system] = set()
            by_coding_systems[coding_system].add(source_concept['id'])
        return CodesByCodingSystems(by_coding_systems)

    def filter_codes_in_dbs(self, codes_in_dbs):
        def aux(voc, codes):
            available_codes = codes_in_dbs.get(voc)
            if available_codes is None:
                return codes
            else:
                return {
                    code for code in codes
                    if code in available_codes
                }
        return CodesByCodingSystems({
            voc: aux(voc, self._by_coding_systems[voc])
            for voc in self._by_coding_systems
        })

    def add(self, coding_system, codes):
        assert coding_system not in self._by_coding_systems
        self._by_coding_systems[coding_system] = codes
    
    def codes(self, coding_system):
        """ Returns codes """
        return self._by_coding_systems.get(coding_system, set())

    def __iter__(self):
        return iter(self._by_coding_systems.keys())


class Mappings:

    def __init__(self, by_events=None):
        self._by_events = by_events or {}

    @classmethod
    def of_raw_data(cls, data):
        return Mappings({
            event: Mapping.of_raw_data(for_event)
            for event, for_event in data['by-event'].items()
        })

    def events(self):
        return list(self._by_events.keys())

    def add(self, event, mapping):
        assert event not in self._by_events
        self._by_events[event] = mapping

    def get(self, event):
        return self._by_events[event]


class Mapping:

    def __init__(self, mapping=None):
        self._mapping = mapping or {}

    @classmethod
    def of_data(cls, data):
        return Mapping({
            key: set(codes) if codes else None
            for key, codes in data.items()
        })

    def to_data(self):
        return {
            key: list(codes) if codes else None
            for key, codes in self._mapping.items()
        }

    @classmethod
    def of_raw_data(cls, for_event):
        def codes(for_database):
            if 'inclusion' in for_database:
                return set(for_database['inclusion']) | \
                    set(for_database.get('exclusion') or [])
            else:
                return None
        return Mapping({
            database: codes(for_database)
            for database, for_database in for_event['by-database'].items()
        })

    def filter_codes_in_dbs(self, codes_in_dbs, databases=None):
        def aux(key, codes):
            if databases is None:
                coding_system = key
            else:
                coding_system = databases.coding_system(key)
            available = codes_in_dbs.get(coding_system)
            return {
                code for code in codes
                if code in available
            }
        return Mapping({
            key: None if codes is None else aux(key, codes)
            for key, codes in self._mapping.items()
        })

    def add(self, key, codes):
        assert key not in self._mapping
        self._mapping[key] = codes

    def codes(self, key):
        return self._mapping[key]

    def keys(self):
        return list(self._mapping.keys())

class Evaluations:

    def __init__(self, evaluations=None):
        self._evaluations = evaluations or defaultdict(lambda: defaultdict(dict))

    @classmethod
    def of_data(cls, data):
        return Evaluations({
            variation_id: {
                event: {
                    database: Evaluation.of_data(evaluation_data)
                    for database, evaluation_data in data[variation_id][event].items()
                }
                for event in data[variation_id]
            }
            for variation_id in data
        })

    def to_data(self):
        return {
            variation_id: {
                event: {
                    database: None if evaluation is None else evaluation.to_data() 
                    for database, evaluation in self._evaluations[variation_id][event].items()
                }
                for event in self._evaluations[variation_id]
            }
            for variation_id in self._evaluations
        }

    
    def add(self, variation_id, event, database, evaluation):
        assert database not in self._evaluations[variation_id][event]
        self._evaluations[variation_id][event][database] = evaluation

    def all(self):
        for variation_id in self._evaluations:
            for event in self._evaluations[variation_id]:
                for database, evaluation in self._evaluations[variation_id][event].items():
                    yield (variation_id, event, database), evaluation

    def get(self, variation_id, event, database):
        return self._evaluations[variation_id][event][database]

    
class Evaluation:

    def __init__(self, cuis, generated, reference, tp, fp, fn, recall, precision):
        for v in [cuis, generated, reference, tp, fp, fn]:
            assert type(v) == set, (type(v), v)
        self.cuis = cuis
        self.generated = generated
        self.reference = reference
        self.tp = tp
        self.fp = fp
        self.fn = fn
        self.recall = recall
        self.precision = precision

    @classmethod
    def of_data(cls, data):
        return Evaluation(**{
            key: set(value) if type(value) == list else value
            for key, value in data.items()
        })

    def to_data(self):
        return {
            key: list(value) if type(value) == set else value
            for key, value in self.__dict__.items()
        }


class Variation:
    
    def __init__(self, concepts, mapping):
        self.concepts = concepts
        self.mapping = mapping

    @classmethod
    def of_data(cls, data):
        concepts = Concepts.of_data(data['concepts'])
        mapping = Mapping.of_data(data['mapping'])
        return Variation(concepts, mapping)

    def to_data(self):
        return {
            'concepts': self.concepts.to_data(),
            'mapping': self.mapping.to_data(),
        }


class Databases:

    def __init__(self, databases, coding_systems):
        self._databases = databases
        self._coding_systems = coding_systems

    @classmethod
    def of_config(cls, config):
        return Databases(config['databases'], config['coding-systems'])

    def databases(self):
        return self._databases

    def coding_system(self, database):
        return self._coding_systems[database]

    def coding_systems(self):
        return sorted(set(self._coding_systems.values()))

    def coding_systems_data(self):
        return self._coding_systems


class CodesInDbs:

    def __init__(self, by_coding_systems):
        self._by_coding_systems = by_coding_systems

    @classmethod
    def of_data(cls, data):
        return CodesInDbs(data)

    def get(self, coding_system):
        for coding_system0 in self._by_coding_systems:
            if coding_system.startswith(coding_system0):
                return self._by_coding_systems[coding_system0]


class Dnf:

    def __init__(self, disjunction=None):
        self._disjunction = disjunction or {}

    def to_data(self):
        return [
            (tuple(cuis), {
                coding_system: list(codes)
                for coding_system, codes in self._disjunction[cuis].items()
            })
            for cuis in self._disjunction
        ]

    @classmethod
    def of_data(cls, data):
        return Dnf({
            frozenset(cuis): {
                coding_system: set(codes)
                for coding_system, codes in by_coding_systems.items()
            }
            for cuis, by_coding_systems in data
        })

    
    def add(self, cuis, coding_system, code):
        cuis = frozenset(cuis)
        if cuis not in self._disjunction:
            self._disjunction[cuis] = {}
        if coding_system not in self._disjunction[cuis]:
            self._disjunction[cuis][coding_system] = set()
        self._disjunction[cuis][coding_system].add(code)

    def cui_sets(self):
        return list(self._disjunction.keys())

    def get(self, cuis):
        return self._disjunction[cuis]
