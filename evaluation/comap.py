from collections import OrderedDict, defaultdict
from itertools import chain
import requests
import pickle
import sys
import re
import os
import yaml

def construct_OrderedDict(loader, node):
    loader.flatten_mapping(node)
    return OrderedDict(loader.construct_pairs(node))
yaml.loader.Loader.add_constructor(yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, construct_OrderedDict)

def represent_OrderedDict(dumper, data):
    return dumper.represent_dict(list(data.items()))
yaml.add_representer(OrderedDict, represent_OrderedDict, yaml.dumper.Dumper)


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


def measures(generated=None, reference=None, codes=None, f=lambda x: x):

    """
    >>> generated = [1,2,3,4]
    >>> reference = [1,2,5,6,7,8]
    >>> expected = {
    ...   'recall': 0.33,
    ...   'precision': 0.5,
    ... }
    >>> f = lambda v: round(v, 2)
    >>> dict(measures(generated=generated, reference=reference, f=f)) == expected
    >>> generated = set(generated)
    >>> reference = set(reference)
    >>> codes = {
    ...   'TP': generated & reference,
    ...   'FP': generated - reference,
    ...   'TP': reference - generated,
    ... }
    >>> dict(codes=codes, f=f) == expected
    """

    if codes is None:
        assert generated is not None and reference is not None, \
            "Provide either argument `generated` and `reference` or `code`."
        generated = set(generated)
        reference = set(reference)
    else:
        assert generated is None and reference is None, \
            "Provide either argument `generated` and `reference` or `code`."
        generated = set(chain(codes['TP'], codes['FP']))
        reference = set(chain(codes['TP'], codes['FN']))

    TP = generated & reference

    recall = f(len(TP) / len(reference)) \
        if len(reference) else None
    precision = f(len(TP) / len(generated)) \
        if len(generated) else None

    return OrderedDict([
        ('recall', recall),
        ('precision', precision),
    ])


class RegexHierarchy(object):

    TYPES = {
        # Letter Digit Digit
        'LDD': re.compile(r'([A-Z]\d{2})\.(\d)'),
        # Digit Digit Digit
        'DDD': re.compile(r'(\d{3})\.(\d)'),
    }


    def __init__(self, regex_type):
        self.hierarchical_code_re = self.TYPES[regex_type]

    def parents(self, code):
        """
        >>> h = RegexHierarchy('LDD')
        >>> set(h.parents("K85.9"))
        {'K85'}
        >>> set(h.parents("K85"))
        set()
        >>> h = RegexHierarchy('DDD')
        >>> set(h.parents("185.9"))
        {'185'}
        """
        m = re.match(self.hierarchical_code_re, code)
        if m:
            return frozenset([m.group(1)])
        else:
            return frozenset()

    def is_sibling(self, code1, code2):
        """
        >>> h = RegexHierarchy('LDD')
        >>> h.is_sibling("K85.1", "K85.2")
        True
        >>> h.is_sibling("K85.1", "K85")
        False
        >>> h.is_sibling("K85.1", "K85.1")
        True
        >>> h.is_sibling("K85.1", "J85.1")
        False
        """
        parent1 = self.parents(code1)
        parent2 = self.parents(code2)
        return bool(parent1 and parent2 and parent1 & parent2)


def parents(hierarchy, codes1, codes2):
    """ Finds the codes in `codes1` that are parents of codes in
    `codes2`. Returns a dictionary from parent codes in `codes1` to
    lists of child codes in `codes2.

    >>> h = RegexHierarchy(letter_digit_digit)
    >>> codes1 = ['K50', 'K50.1', 'K51', 'K52']
    >>> codes2 = ['K50.2', 'K50.3', 'K52.1', 'K51.1', 'K53', 'K53.1']
    >>> expected = {
    ...     frozenset({'K50'}): {'K50.2', 'K50.3'},
    ...     frozenset({'K51'}): {'K51.1'},
    ...     frozenset({'K52'}): {'K52.1'},
    ... }
    >>> parents(h, codes1, codes2) == expected
    True
    """
    res = defaultdict(set)
    for code2 in codes2:
        parents_of_code2 = hierarchy.parents(code2) & set(codes1)
        if parents_of_code2:
            res[parents_of_code2].add(code2)
    return res


def siblings(hierarchy, codes1, codes2):

    """ Finds all pairs of siblings from `codes1` and `codes2` that are siblings.

    >>> h = RegexHierarchy(letter_digit_digit)
    >>> codes1 = ['K50', 'K50.1', 'K50.2', 'K51.1']
    >>> codes2 = ['K51', 'K50.3', 'K50.4']
    >>> expected = {(frozenset({'K50.1', 'K50.2'}), frozenset({'K50.3', 'K50.4'}))}
    >>> siblings(h, codes1, codes2) == expected
    True
    >>> codes1 = ['K50', 'K50.1', 'K50.2', 'K51.1', 'K51.2']
    >>> codes2 = ['K49', 'K50.2', 'K51.3', 'K51.4']
    >>> expected = {(frozenset({'K50.1', 'K50.2'}), frozenset({'K50.2'})),
    ...             (frozenset({'K51.1', 'K51.2'}), frozenset({'K51.3', 'K51.4'}))}
    >>> siblings(h, codes1, codes2) == expected
    True
    >>> codes1 = ['K50.1', 'K50.2']
    >>> codes2 = ['K51.1', 'K51.2']
    >>> siblings(h, codes1, codes2) == set()
    True
    """
    def sibling_sets(codes):
        codes = set(codes)
        res = list()
        while codes:
            code = codes.pop()
            siblings = [
                code0 for code0 in codes
                if hierarchy.is_sibling(code0, code)
            ]
            for sibling in siblings:
                codes.discard(sibling)
            res.append(set([code] + siblings))
        return res
    sibling_sets1 = sibling_sets(codes1)
    sibling_sets2 = sibling_sets(codes2)
    return set([
        (frozenset(siblings1), frozenset(siblings2))
        for siblings1 in sibling_sets1
        for siblings2 in sibling_sets2
        if any(hierarchy.is_sibling(code1, code2)
               for code1 in siblings1
               for code2 in siblings2)
    ])


def related(hierarchy, codes1, codes2):

    parents_of_codes2 = parents(hierarchy, codes1, codes2)
    children_of_codes2 = parents(hierarchy, codes2, codes1)
    siblings_of_codes2 = siblings(hierarchy, codes1, codes2)

    return OrderedDict([
        (label, codes)
        for label, codes in [
            ('parents', set(c for cs in parents_of_codes2.keys() for c in cs)),
            ('children', set(c for cs in children_of_codes2.values() for c in cs)),
            ('siblings', set(c for cs, _ in siblings_of_codes2 for c in cs)),
        ]
        if codes
    ])


def normalize_related(hierarchy, codes):

    """
    >>> h = comap.RegexHierarchy('LDD')
    >>> codes = {
    ...     'TP': [],
    ...     'FP': [],
    ...     'FN': [],
    ... }
    >>> expected = OrderedDict([
    ...     ('codes',
    ... ])
    >>> error_analysis(h, codes)['codes'] == expected_codes
    True
    """

    TP, FP, FN = [set(codes[key]) for key in ('TP', 'FP', 'FN')]
    generated = TP | FP
    reference = TP | FN

    FP_related_to_reference_by_rel = related(hierarchy, FP, reference)
    FP_related_to_reference = \
        set(c for cs in FP_related_to_reference_by_rel.values() for c in cs)
    FP_unrelated = FP - FP_related_to_reference

    FN_related_to_generated_by_rel = related(hierarchy, FN, generated)
    FN_related_to_generated = \
        set(c for cs in FN_related_to_generated_by_rel.values() for c in cs)
    FN_unrelated = FN - FN_related_to_generated

    generated_with_related_FN = generated | FN_related_to_generated
    reference_with_related_FP = reference | FP_related_to_reference

    TP_with_related = generated_with_related_FN & reference_with_related_FP

    assert FP_unrelated == generated_with_related_FN - TP_with_related
    assert FN_unrelated == reference_with_related_FP - TP_with_related

    related_codes = OrderedDict([
        ('TP', TP_with_related),
        ('FP', FP_unrelated),
        ('FN', FN_unrelated),
    ])

    derivated_codes = OrderedDict([
        ('FP-related-to-reference', FP_related_to_reference_by_rel),
        ('FN-related-to-generated', FN_related_to_generated_by_rel),
    ])

    return related_codes, derivated_codes


def evaluations_to_xls(evaluations, databases, outcome_ids, filename, outcomes=None):
    import pandas as pd
    columns_per_database = ['TP', 'FP', 'FN', 'recall', 'precision']
    columns = pd.MultiIndex.from_tuples([
        (database if type(database) == str else
         '{} ({})'.format(*database),
         c)
        for database in databases
        for c in columns_per_database
    ])
    index, rows = [], []
    for ix, (heading, results) in enumerate(evaluations.items()):
        str_of_list = lambda v: ' '.join(str(v0) for v0 in v)
        if ix:
            index.extend(['', ''])
            rows.extend([[None] * len(columns)] * 2)
        index.append(heading)
        rows.append([None] * len(columns))
        for outcome_id in outcome_ids:
            row = []
            for database, _ in databases:
                comparison = results[outcome_id][database]
                if comparison is None:
                    row.extend([None] * len(columns_per_database))
                else:
                    row.extend([
                        str_of_list(comparison['codes']['TP']),
                        str_of_list(comparison['codes']['FP']),
                        str_of_list(comparison['codes']['FN']),
                        comparison['measures']['recall'],
                        comparison['measures']['precision'],
                    ])
            index.append(outcomes[outcome_id]['name'] if outcomes else outcome_id)
            rows.append(row)

    writer = pd.ExcelWriter(filename)
    df = pd.DataFrame(rows, index=pd.Index(index), columns=columns)
    df.to_excel(writer, float_format='%.2f')
    writer.save()


if os.getenv('DOCTEST'):
    import doctest
    doctest.testmod()
