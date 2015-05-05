import requests
import pickle
import sys


COMAP_COOKIES_FILE = '.comap-cookies'


def get_cookies(comap_api_url):
    try:
        with open(COMAP_COOKIES_FILE, 'rb') as f:
            cookies = pickle.load(f)
        url = comap_api_url + '/authentification/user'
        r = requests.post(url, cookies=cookies)
        if not r.json():
            raise
        return cookies
    except:
        url = comap_api_url + '/authentification/login'
        data = dict(username='b.becker', password='Codemapper2015')
        r = requests.post(url, data=data)
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
        url = self.comap_api_url + '/code-mapper/coding-systems'
        r = requests.get(url, cookies=self.cookies)
        return r.json()

    def umls_concepts(self, cuis, coding_systems):
        url = self.comap_api_url + '/code-mapper/umls-concepts'
        data = {
            'cuis': cuis,
            'codingSystems': coding_systems
        }
        r = requests.post(url, data=data, cookies=self.cookies)
        if r.ok:
            return r.json()
        else:
            print("Couldn't post {}.".format(r.url), file=sys.stderr)

    def hyponyms(self, cuis, coding_systems):
        url = self.comap_api_url + '/code-mapper/related/hyponyms'
        data = {
            'cuis': cuis,
            'codingSystems': coding_systems
        }
        r = requests.post(url, data=data, cookies=self.cookies)
        if r.ok:
            return r.json()
        else:
            print("Couldn't get " + r.request.path_url, file=sys.stderr)
