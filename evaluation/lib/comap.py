from collections import defaultdict
import re
import requests
import pickle
import pymysql
import utils

# import http.client
# http.client.HTTPConnection.debuglevel = 1

logger = utils.get_logger(__name__)

PEREGRINE_API_URL = 'http://euadr.erasmusmc.nl:8080/UMLS2014AB_ADVANCE/rest'
COMAP_API_URL = 'http://localhost:8080/CoMap/rest'
COMAP_COOKIES_FILE = '.comap-cookies'
DB_ACCESS = dict(host='127.0.0.1', user='root', password='root', port=3306)

def get_cookies():
    try:
        with open(COMAP_COOKIES_FILE, 'rb') as f:
            cookies = pickle.load(f)
        url = COMAP_API_URL + '/authentification/user'
        r = requests.get(url, cookies=cookies)
        if not r.ok or r.status_code != 200:
            cookies = login()
    except IOError:
        cookies = login()
    return cookies


def login():
    logger.debug("Login")
    url = COMAP_API_URL + '/authentification/login'
    data = dict(username='b.becker', password='Codemapper2015')
    r = requests.post(url, data=data)
    with open(COMAP_COOKIES_FILE, 'wb') as f:
        pickle.dump(r.cookies, f)
    return r.cookies


def cui_of_id(id):
    return "C{:0>7s}".format(id)


def peregrine_index(text):
    logger.info('Indexing...')
    text = re.sub(r'\s', ' ', text)
    r = requests.get(PEREGRINE_API_URL + '/index', params=dict(text=text))
    return r.json()['spans']


class ComapClient(object):

    def __init__(self):
        self.cookies = get_cookies()

    def coding_systems(self):
        logger.info('Get coding systems...')
        url = COMAP_API_URL + '/code-mapper/coding-systems'
        r = requests.get(url, cookies=self.cookies)
        return r.json()

    def umls_concepts(self, cuis, coding_systems):
        logger.info('Get UMLS concepts for %d CUIs and %d coding systems', len(cuis), len(coding_systems))
        url = COMAP_API_URL + '/code-mapper/umls-concepts'
        data = {
            'cuis': cuis,
            'codingSystems': coding_systems
        }
        r = requests.post(url, data=data, cookies=self.cookies)
        if r.ok:
            return r.json()
        else:
            raise Exception("Couldn't retrieve umls concepts")

    def hyponyms(self, cuis, coding_systems):
        logger.info('Get UMLS hyponyms for %d CUIs', len(cuis))
        url = COMAP_API_URL + '/code-mapper/related/hyponyms'
        data = {
            'cuis': cuis,
            'codingSystems': coding_systems
        }
        r = requests.post(url, data=data, cookies=self.cookies)
        if r.ok:
            return r.json()
        else:
            raise Exception("Couldn't retrieve hyponyms")

    def related(self, cuis, relations, coding_systems):
        logger.info("Get related of %s CUIs through %s", len(cuis), ', '.join(relations))
        url = COMAP_API_URL + '/code-mapper/related'
        data = {
            'cuis': cuis,
            'relations': relations,
            'codingSystems': coding_systems,
        }
        r = requests.post(url, data=data, cookies=self.cookies)
        if r.ok:
            return r.json()
        else:
            raise Exception("Couldn't retrieve related concepts")


__comap_client = None
def get_client():
    global __comap_client
    if not __comap_client:
        __comap_client = ComapClient()
    return __comap_client

# READ2/3

_umls_db = None
def get_umls_db():
    global _umls_db
    if _umls_db is None:
        _umls_db = pymysql.connect(db='UMLS2014AB_CoMap', **DB_ACCESS)
    return _umls_db

_umls_ext_db = None
def get_umls_ext_db():
    global _umls_ext_db
    if _umls_ext_db is None:
        _umls_ext_db = pymysql.connect(db='UMLS_ext_mappings', **DB_ACCESS)
    return _umls_ext_db


def translation_read_2to3(codes):
    """ { read2_code: { read3_code } } """
    translation = defaultdict(set)
    if not codes:
        return translation
    with get_umls_ext_db().cursor() as cursor:
        query = """
            select distinct V2_CONCEPTID, CTV3_CONCEPTID
            from RCD_V3_to_V2
            where V2_CONCEPTID in %s
        """
        cursor.execute(query, [codes])
        for code2, code3 in cursor.fetchall():
            translation[code2].add(code3)
    return translation


def translation_read_3to2(codes):
    """ { read2_code: { read3_code } } """
    translation = defaultdict(set)
    if codes:
        with get_umls_ext_db().cursor() as cursor:
            query = """
                select distinct V2_CONCEPTID, CTV3_CONCEPTID
                from RCD_V3_to_V2
                where CTV3_CONCEPTID in %s
                and V2_CONCEPTID not in ('_DRUG', '_NONE')
            """
            cursor.execute(query, [codes])
            for code2, code3 in cursor.fetchall():
                translation[code3].add(code2)
    return translation


def known_codes(codes, coding_system):
    "Returns a subset of `codes` where every code can be found in UMLS/RCD2."
    
    if not codes:
        return set()

    original_coding_system = coding_system
    if coding_system == 'RCD2':
        original_codes = codes
        t = translation_read_2to3(codes)
        codes = { code3 for codes3 in t.values() for code3 in codes3 }
        coding_system = 'RCD'

    query = """
    select distinct code
    from MRCONSO
    where sab = %s
    and BINARY code in %s
    """ # BINARY for case-sensitive in-clause
    with get_umls_db().cursor() as cursor:
        cursor.execute(query, [coding_system, codes])
        res = { code for code, in cursor.fetchall() }

    if original_coding_system == 'RCD2':
        res = {
            code2 for code2 in original_codes
            if any(code3 in res for code3 in t[code2]
                   for _ in [print(code2, code3, code2 in original_codes, code3 in res, res)])
        }
        
    return res

def codes_of_raw_concept(concept, coding_system):
    return {
        sourceConcept['id']
        for sourceConcept in concept['sourceConcepts']
        if sourceConcept['codingSystem'] == coding_system
    }
