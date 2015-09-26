from collections import defaultdict
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
DB_ACCESS = dict(host='127.0.0.1', user='root', password='root')

def get_cookies():
    try:
        with open(COMAP_COOKIES_FILE, 'rb') as f:
            cookies = pickle.load(f)
        url = COMAP_API_URL + '/authentification/user'
        r = requests.post(url, cookies=cookies)
        if not r.ok:
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
    if codes:
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
