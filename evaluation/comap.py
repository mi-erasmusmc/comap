import requests
import pickle
import os
import yaml

#COMAP_API_URL = 'http://euadr:8080/CoMap/rest/'
#PEREGRINE_API_URL = 'http://euadr:8080/UMLS2014AB_ADVANCE/rest/'
COMAP_API_URL = 'http://localhost:8080/AdvanceCodeMapper/rest/'
PEREGRINE_API_URL = 'http://euadr.erasmusmc.nl:8080/UMLS2014AB_ADVANCE/rest/'

CASE_DEFINITIONS_FOLDER = 'case-definitions'
COMAP_COOKIES_FILE = '.comap-cookies'

def get_cookies():
    try:
        with open(COMAP_COOKIES_FILE, 'rb') as f:
            cookies = pickle.load(f)
        r = requests.post(COMAP_API_URL+'authentification/user', cookies=cookies)
        if not r.json():
            raise
        return cookie
    except:
        data = dict(username='b.becker', password='Codemapper2015')
        r = requests.post(COMAP_API_URL+'authentification/login', data=data)
        with open(COMAP_COOKIES_FILE, 'wb') as f:
            pickle.dump(r.cookies, f)
        return r.cookies

    
def cui_of_id(id):
    return "C{:0>7s}".format(id)

def load_casedef(id):
    path = os.path.join(CASE_DEFINITIONS_FOLDER, id + '.yaml')
    casedef = yaml.load(open(path))
    return casedef['definition'].strip()

def peregrine_index(text):
    r = requests.get(PEREGRINE_API_URL+'index', params=dict(text=text))
    return r.json()['spans']

    
class ComapClient(object):

    def __init__(self):
        self.cookies = get_cookies()

    def coding_systems(self):
        r = requests.get(COMAP_API_URL+'code-mapper/coding-systems', cookies=self.cookies)
        return r.json()
        
    def umls_concepts(self, cuis, codingSystems):
        data = data=dict(cuis=cuis, codingSystems=codingSystems)
        r = requests.post(COMAP_API_URL+'code-mapper/umls-concepts', data=data, cookies=self.cookies)
        return r.json()
