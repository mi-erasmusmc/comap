import logging, logging.config
from collections import OrderedDict
import yaml
import redo

if redo.running():
    logging.config.fileConfig(str(redo.path / 'lib' / 'logging.config'))

def get_logger(name):
    return logging.getLogger(name)

logger = logging.getLogger(__name__)

def construct_OrderedDict(loader, node):
    loader.flatten_mapping(node)
    return OrderedDict(loader.construct_pairs(node))
yaml.loader.Loader.add_constructor(yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, construct_OrderedDict)

def represent_OrderedDict(dumper, data):
    return dumper.represent_dict(list(data.items()))
yaml.add_representer(OrderedDict, represent_OrderedDict, yaml.dumper.Dumper)


def load_mappings(f):
    """ Creates: { event: { database: codes } } """
    mappings = yaml.load(f)
    result = OrderedDict()
    for event in mappings['by-event']:
        result[event] = OrderedDict()
        for database, mapping in mappings['by-event'][event]['by-database'].items():
            inclusion, exclusion = mapping.get('inclusion'), mapping.get('exclusion', [])
            if inclusion is not None:
                codes = list(set(inclusion + exclusion))
            else:
                codes = None
            result[event][database] = codes
    return result

        
def mappings_by_database(mappings):
    """ Argument: { event: { database: codes } }
        Result:   { database: { event: codes } } """
    result = OrderedDict()
    for event in mappings:
        databases = list(mappings[event].keys())
        break
    for database in databases:
        result[database] = OrderedDict()
        for event in mappings:
            result[database][event] = mappings[event][database]
    return result

def dnf_to_simple(dnf):
    return [
        (list(cuis), {
            coding_system: list(dnf[cuis][coding_system])
            for coding_system in dnf[cuis]
        })
        for cuis in dnf
    ]

def dnf_of_simple(simple):
    return {
        frozenset(cuis): {
            coding_system: set(codes_by_coding_system[coding_system])
            for coding_system in codes_by_coding_system
        }
        for cuis, codes_by_coding_system in simple
    }

def concepts_by_coding_system(concepts, coding_systems_list):
    """
    `concepts`: { cui: { coding_system: [code, ...] } }
    RESULT: { coding_system: [code, ... ] }
    """
    result = { coding_system: set() for coding_system in coding_systems_list }
    for cui in concepts:
        for coding_system in concepts[cui]:
            for code in concepts[cui][coding_system]:
                result[coding_system].add(code)
    return { coding_system: sorted(result[coding_system]) for coding_system in result }
