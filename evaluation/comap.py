import requests
import pickle
import os
import yaml

CASE_DEFINITIONS_FOLDER = 'case-definitions'
COMAP_COOKIES_FILE = '.comap-cookies'

def get_cookies(comap_api_url):
    try:
        with open(COMAP_COOKIES_FILE, 'rb') as f:
            cookies = pickle.load(f)
        r = requests.post(comap_api_url + '/authentification/user', cookies=cookies)
        if not r.json():
            raise
        return cookie
    except:
        data = dict(username='b.becker', password='Codemapper2015')
        r = requests.post(comap_api_url + '/authentification/login', data=data)
        with open(COMAP_COOKIES_FILE, 'wb') as f:
            pickle.dump(r.cookies, f)
        return r.cookies

    
def cui_of_id(id):
    return "C{:0>7s}".format(id)

def peregrine_index(text, peregrine_api_url):
    r = requests.get(peregrine_api_url + '/index', params=dict(text=text))
    return r.json()['spans']

    
class ComapClient(object):

    def __init__(self, comap_api_url):
        self.comap_api_url = comap_api_url
        self.cookies = get_cookies(self.comap_api_url)

    def coding_systems(self):
        r = requests.get(self.comap_api_url + '/code-mapper/coding-systems', cookies=self.cookies)
        return r.json()
        
    def umls_concepts(self, cuis, codingSystems):
        data = data=dict(cuis=cuis, codingSystems=codingSystems)
        r = requests.post(self.comap_api_url + '/code-mapper/umls-concepts', data=data, cookies=self.cookies)
        return r.json()

    def hyponyms(self, cuis, codingSystems):
        data = {
            'cuis': cuis,
            'codingSystems': codingSystems
        }
        r = requests.post(self.comap_api_url + '/code-mapper/related/hyponyms', data=data, cookies=self.cookies)
        self.r = r
        return r.json()
    
