import logging
import re
import comap
from data import Mapping, Mappings, Concepts, CodesByCodingSystems

logger = logging.getLogger(__name__)


def normalize_upper(code):
    return code.upper()

def normalize_drop_suffix_dot(code):
    if code[-1] == '.':
        return code[:-1]
    else:
        return code

def normalize_3letters(code):
    return code[:3]

def normalize_xdd_code(code):
    code = code.upper()
    m1 = re.match(comap.RegexHierarchy.TYPES['LDD'], code)
    try:
        return m1.group('parent')
    except:
        m2 = re.match(comap.RegexHierarchy.TYPES['DDD'], code)
        try:
            return m2.group('parent')
        except:
            return code

def format_icd(code):
    if len(code) > 3 and code[3] != '.':
        return code[:3] + '.' + code[3:]
    else:
        return code


READ_RE = re.compile(r'(?P<code>[A-Za-z0-9\d][A-Za-z0-9.]{4}).*')
def normalize_read(code):
    m = READ_RE.match(code)
    if m:
        return m.group('code')
    else:
        logger.warn("Not a READ2 code: %s", code)
        return code

_normalizers = {
    'ICPC': [normalize_upper, normalize_drop_suffix_dot, normalize_xdd_code, normalize_3letters],
    'ICD': [normalize_upper, format_icd],
    'RCD': [normalize_read],
}

def chain(fs):
    def f(codes):
        result = []
        for code in codes:
            for f in fs:
                code = f(code)
            result.append(code)
        return result
    return f

def get_normalizer(coding_system):
    for coding_system0 in _normalizers:
        if coding_system.startswith(coding_system0):
            return chain(_normalizers[coding_system0])
    logger.error("No normalizer for coding system %s", coding_system)


def mappings(mappings, databases):
    result = Mappings()
    for event in mappings.events():
        mapping = mappings.get(event)
        result_mapping = Mapping()
        for database in mapping.keys():
            coding_system = databases.coding_system(database)
            normalizer = get_normalizer(coding_system)
            codes = mapping.codes(database)
            if codes is not None:
                codes = normalizer(codes)
            result_mapping.add(database, codes)
        result.add(event, result_mapping)
    return result

def concepts(concepts, coding_systems):
    result = Concepts()
    for cui in concepts.cuis():
        codes_by_coding_system = CodesByCodingSystems()
        for coding_system in coding_systems:
            normalizer = get_normalizer(coding_system)
            codes = set(normalizer(concepts.cui(cui).codes(coding_system)))
            codes_by_coding_system.add(coding_system, codes)
        result.add(cui, codes_by_coding_system)
    return result
