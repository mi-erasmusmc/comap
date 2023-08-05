import sys
import shutil
import os
import pandas as pd
import psycopg2
import psycopg2.extras
import pickle
import multiprocessing as mp
from collections import namedtuple
from unidecode import unidecode
from glob import glob
from nltk import edit_distance
from nltk.tokenize import word_tokenize

SEP = "-',/"

COLUMN_MAPPING = (
    ["Coding system", "Code", "Code name", "Concept", "Concept name"],
    ["coding_system", "code", "code_name", "concept", "concept_name"],
)

KEY_COLUMNS = 'coding_system code code_name concept concept_name'.split()

INPUT_COLUMNS = ["Coding system", "Code", "Code name", "Concept", "Concept name"]

DEDUP_COLS = [
    "dedup_original_code",
    "dedup_original_code_name",
    "dedup_result",
    "dedup_comment",
    "dedup_code",
    "dedup_code_name",
    "dedup_coding_system",
    "dedup_changed",
    "dedup_ttys",
    "dedup_ignore",
    "dedup_names_by_code",
    "dedup_codes_by_name",
]

RESULT_DETAILS = {
    "BY_CODE_AND_NAME"         : "code and code name match",
    "CODE_BY_NAME"             : "code by code name",
    "CODE_BY_CUI"              : "code by concept",
    "CODE_NAME_BY_CUI"         : "code name by concept",
    "NAME_BY_CODE"             : "code name by code",
    "NONE"                     : "nothing found",
    "NONE_CODING_SYSTEM"       : "unknown coding system or free text",
    "NONE_NO_CODE"             : "no code",
    "NONE_SAME_CUI"            : "code concept and code name concept match but mismatch with concept",
    "NONE_SAME_CUI_NO_CONCEPT" : "code concept and code name concept match but no concept",
    "OTHER_CODING_SYSTEM"      : "changed coding system",
}

IGNORE_TTYS = set("AA AD AM AS AT CE EP ES ETAL ETCF ETCLIN ET EX GT IS IT LLTJKN1 LLTJKN LLT LO MP MTH_ET MTH_IS MTH_LLT MTH_LO MTH_OAF MTH_OAP MTH_OAS MTH_OET MTH_OET MTH_OF MTH_OL MTH_OL MTH_OPN MTH_OP OAF OAM OAM OAP OAS OA OET OET OF OLC OLG OLJKN1 OLJKN1 OLJKN OLJKN OL OL OM OM ONP OOSN OPN OP PCE PEP PHENO_ET PQ PXQ PXQ SCALE TQ XQ".split())

CODING_SYSTEMS = set("IR ALT AOD AOT ATC BI CCC CCPSS CCS CCSR_ICD10CM CCSR_ICD10PCS CDCREC CDT CHV COSTAR CPM CPT CPTSP CSP CST CVX DDB DMDICD10 DMDUMD DRUGBANK DSM-5 DXP FMA GO GS HCDT HCPCS HCPT HGNC HL7V2.5 HL7V3.0 HPO ICD10 ICD10AE ICD10AM ICD10AMAE ICD10CM ICD10DUT ICD10PCS ICD9CM ICF ICF-CY ICNP ICPC ICPC2EDUT ICPC2EENG ICPC2ICD10DUT ICPC2ICD10ENG ICPC2P ICPCBAQ ICPCDAN ICPCDUT ICPCFIN ICPCFRE ICPCGER ICPCHEB ICPCHUN ICPCITA ICPCNOR ICPCPOR ICPCSPA ICPCSWE JABL KCD5 LCH LCH_NW LNC LNC-DE-AT LNC-DE-DE LNC-EL-GR LNC-ES-AR LNC-ES-ES LNC-ES-MX LNC-ET-EE LNC-FR-BE LNC-FR-CA LNC-FR-FR LNC-IT-IT LNC-KO-KR LNC-NL-NL LNC-PL-PL LNC-PT-BR LNC-RU-RU LNC-TR-TR LNC-UK-UA LNC-ZH-CN MCM MDR MDRARA MDRBPO MDRCZE MDRDUT MDRFRE MDRGER MDRGRE MDRHUN MDRITA MDRJPN MDRKOR MDRLAV MDRPOL MDRPOR MDRRUS MDRSPA MDRSWE MED-RT MEDCIN MEDLINEPLUS MEDLINEPLUS_SPA MMSL MMX MSH MSHCZE MSHDUT MSHFIN MSHFRE MSHGER MSHITA MSHJPN MSHLAV MSHNOR MSHPOL MSHPOR MSHRUS MSHSCR MSHSPA MSHSWE MTH MTHCMSFRF MTHICD9 MTHICPC2EAE MTHICPC2ICD10AE MTHMST MTHMSTFRE MTHMSTITA MTHSPL MVX NANDA-I NCBI NCI NDDF NEU NIC NOC NUCCHCPT OMIM OMS ORPHANET PCDS PDQ PNDS PPAC PSY QMR RAM RCD RCDAE RCDSA RCDSY RXNORM SCTSPA SNM SNMI SNOMEDCT_US SNOMEDCT_VET SOP SPN SRC TKMT ULT UMD USP USPMG UWDA VANDF WHO WHOFRE WHOGER WHOPOR WHOSPA".split() + ["RCD2", "ICD10/CM"])

def norm_str(str, wildcard):
    if wildcard:
        for s in SEP:
            str = str.replace(s, wildcard)
    return unidecode(str)

def term_norm(str):
    str = (str
           .replace("kidney", "KIDNEY")
           .replace("renal", "KIDNEY"))
    return norm_str(str, "_")

def term_match(str1, str2):
    return term_norm(str1) == term_norm(str2)

def tok_match(tok1, tok2):
    n1 = len(tok1)
    n2 = len(tok2)
    return (
        tok1 == tok2 or
        tok1.startswith(tok2) or
        tok2.startswith(tok1) or
        edit_distance(tok1, tok2) <= (max(n1, n2) - min(n1, n2))
    )

def abbr_prep(str):
    for s in SEP:
        str = str.replace(s, ' ')
    return str.lower()

def term_match_abbr(str1, str2):
    toks1 = [t for t in word_tokenize(abbr_prep(str1)) if t.isalpha()]
    toks2 = [t for t in word_tokenize(abbr_prep(str2)) if t.isalpha()]
    n1 = len(toks1)
    n2 = len(toks2)
    jumps = 0
    ix1 = 0
    ix2 = 0
    while True:
        end1 = ix1 == len(toks1)
        end2 = ix2 == len(toks2)
        if end1 or end2:
            # number of remaining tokens plus jumps less than threshold
            return (
                (len(toks1) - ix1) +
                (len(toks2) - ix2) +
                jumps < max(n1, n2) / 4
            )
        tok1 = toks1[ix1]
        tok2 = toks2[ix2]
        if tok_match(tok1, tok2):
            # print("Ok", tok1, tok2)
            ix1 +=1
            ix2 +=1
        else:
            if ix2+1 < len(toks2) and tok_match(tok1, toks2[ix2+1]):
                # jump over tok2
                # print("J2", tok1, tok2)
                jumps += 1
                ix2 += 1
            elif ix1+1 < len(toks1) and tok_match(toks1[ix1+1], tok2):
                # jump over tok1
                # print("J1", tok1, tok2)
                jumps += 1
                ix1 += 1
            else:
                # print("NO", tok1, tok2)
                return False
            ix1 += 1
            ix2 += 1

def code_norm(code, coding_system):
    if coding_system == 'SNOMEDCT_US' or coding_system == 'SCTSPA':
        if len(code) == 17 and code.endswith("00"):
            return code[:-1] + '0'
    return code.strip('0').rstrip('.')

def code_match(code1, code2, coding_system):
    match = code_norm(code1, coding_system) == code_norm(code2, coding_system)
    if match:
        return True
    if coding_system == 'SNOMEDCT_US' or coding_system == 'SCTSPA':
        if len(code2) == 17 and code2.endswith('00'):
            code2 = code2.rstrip('0')
            code1 = code1[:len(code2)]
        return code1 == code2
    return False

def sab_lang(sab):
    return "SPA" if sab == 'SCTSPA' else "ENG"

def sab_test(coding_system, prefix=""):
    if coding_system == 'SCTSPA':
        return f"({prefix}sab = %s or {prefix}sab = 'SNOMEDCT_US')"
    else:
        return f'{prefix}sab = %s'

# CUI, STR, CODE, TTYS (on sab and str)
def codes_by_name(cursor, sab, str):
    query = f"""
    select cui, str, code, string_agg(tty,',') as ttys
    from mrconso
    where {sab_test(sab)}
    and str ilike %s
    group by cui, str, code
    """
    cursor.execute(query, (sab, norm_str(str, '_')))
    return [dict(r) for r in cursor.fetchall()]

def codes_by_name_rcd2(cursor, cursor_rcd, str):
    query = f"""
    select distinct code
    from corev2
    where description = %s
    """
    cursor_rcd.execute(query, (str, ))
    codes_v2 = [r['code'] for r in cursor_rcd.fetchall()]      # [v2]
    codes_ctv3 = rcd2_to_rcd3(cursor_rcd, codes_v2)            # {v2: [ctv3]}
    codes_ctv3 = [c for cs in codes_ctv3.values() for c in cs] # [ctv3]
    concepts = concepts_of_codes(cursor, "RCD", codes_ctv3)    # {ctv3: {cui, ttys}}
    return [
        {**r, 'code': v2, 'str': str}
        for v2 in codes_v2
        for ctv3 in codes_ctv3
        for r in concepts.get(ctv3, [])
    ]

def concepts_of_codes(cursor, sab, codes):
    query = f"""
    select distinct code, cui, string_agg(tty, ',') as ttys
    from mrconso
    where sab = %s
    and code = any(%s)
    group by code, cui
    """
    cursor.execute(query, (sab, codes))
    res = {}
    for r in cursor.fetchall():
        res.setdefault(r['code'], []).append({'cui': r['cui'], 'ttys': r['ttys']})
    return res

# CUI, STR, CODE, TTYS (on sab and codes)
def names_by_codes(cursor, sab, code):
    query = f"""
    select cui, str, code, string_agg(tty,',') as ttys
    from mrconso
    where {sab_test(sab)}
    and code = %s
    group by cui, str, code
    """
    cursor.execute(query, (sab, code))
    return [dict(r) for r in cursor.fetchall()]

def names_by_codes_rcd2(cursor, cursor_rcd, code):
    query = f"""
    select distinct description
    from corev2
    where code = %s
    """
    cursor_rcd.execute(query, (code,))
    strs = [r['description'] for r in cursor_rcd.fetchall()]   # [str]
    codes_ctv3 = rcd2_to_rcd3(cursor_rcd, list(code))          # {v2: [ctv3]}
    codes_ctv3 = [c for cs in codes_ctv3.values() for c in cs] # [ctv3]
    concepts = concepts_of_codes(cursor, "RCD", codes_ctv3)    # {ctv3: {cui, ttys}}
    return [
        {**c, 'str': str, 'code': code}
        for str in strs
        for ctv3 in codes_ctv3
        for c in concepts[ctv3]
    ]

# CUI, STR, CODE, TTYS (on sab, code or str)
def synonyms_for_code_or_str(cursor, sab, code, str):
    query = f"""
    select distinct m2.cui, m2.sab, m2.str, m2.code, m1.tty as ttys
    from mrconso m1
    inner join mrconso m2
    on m1.cui = m2.cui
    where {sab_test(sab, prefix="m1.")}
    and (m1.code = %s or m1.str ilike %s)
    and m2.lat = %s
    """
    cursor.execute(query, (sab, code, str.replace('-', '_'), sab_lang(sab)))
    return [dict(r) for r in cursor.fetchall()]

# list(v2_conceptid) => {v2_conceptid: list(ctv3_conceptid)}
def rcd2_to_rcd3(cursor, codes):
    query = f"""
    select distinct v2_conceptid, ctv3_conceptid
    from ctv3rctmap_uk_20161001
    where v2_conceptid = any(%s)
    and maptyp != 'n'
    and mapstatus = 1
    and isassured = 1
    and v2_conceptid not in ('_DRUG', '_NONE')
    order by v2_conceptid
    """
    cursor.execute(query, (codes,))
    res = {}
    for r in cursor.fetchall():
        res.setdefault(r['v2_conceptid'], []).append(r['ctv3_conceptid'])
    return res

# list(ctv3_conceptid) => {ctv3_conceptid: list(v2_conceptid)}
def rcd3_to_rcd2(cursor, codes):
    if not codes:
        return {}
    query = f"""
    select ctv3_conceptid, v2_conceptid
    from ctv3rctmap_uk_20161001
    where ctv3_conceptid = any(%s)
    and maptyp != 'n'
    and mapstatus = 1
    and isassured = 1
    and v2_conceptid not in ('_DRUG', '_NONE')
    order by ctv3_conceptid
    """
    cursor.execute(query, (list(codes),))
    res = {}
    for r in cursor.fetchall():
        res.setdefault(r['ctv3_conceptid'], []).append(r['v2_conceptid'])
    return res
    

# [{'code': ctv3_conceptid, ...}] => [{'code': v2_conceptid, ...}]
def rcd3_to_rcd2_names(cursor, name_codes):
    ctv3_codes = set(r['code'] for r in name_codes)
    v2_codes = rcd3_to_rcd2(cursor, ctv3_codes)
    return [
        {**r, **{'code': v2}}
        for r in name_codes
        for v2 in v2_codes.get(r['code'], [])
    ]

def in_coding_system(cursor, code, str):
    query = """
    select cui, sab, str, code, string_agg(tty,',') as ttys
    from mrconso
    where code = %s
    and str = %s
    group by cui, sab, str, code
    """
    cursor.execute(query, (code, str))
    return [dict(r) for r in cursor.fetchall()]

def known_coding_systems(cursor):
    query = """
    select distinct sab from mrconso
    """
    cursor.execute(query)
    return [r['sab'] for r in cursor.fetchall()] + EXTRA_VOCABULARIES

class Categorization:

    def __init__(self):
        self.result = None
        self.row = None
        self.names_by_code = None
        self.codes_by_name = None
        self.synonyms = None
        self.comment = None

    def __str__(self):
        return self.result

    def to_record(self):
        return {
            'dedup_result': self.result,
            'dedup_row': self.row,
            'dedup_names_by_code': self.names_by_code,
            'dedup_codes_by_name': self.codes_by_name,
            'dedup_comment': self.comment,
        }

# row: {'coding_system': sab, 'code': str, 'code_name': str}
def categorize(cursor, cursor_rcd, row):

    cat = Categorization()

    if not row['code'] or row['code'] == '-':
        cat.result = "NONE_NO_CODE"
        return cat

    if pd.isna(row['coding_system']) or row['coding_system'].strip() not in CODING_SYSTEMS:
        cat.result = "NONE_CODING_SYSTEM"
        return cat

    is_rcd2 = row['coding_system'] == 'RCD2'

    if is_rcd2:
        cat.names_by_code = names_by_codes_rcd2(cursor, cursor_rcd, row['code'])
        cat.codes_by_name = codes_by_name_rcd2(cursor, cursor_rcd, row['code_name'])
    else:
        cat.names_by_code = names_by_codes(cursor, row['coding_system'], row['code'])
        cat.codes_by_name = codes_by_name(cursor, row['coding_system'], row['code_name'])

    rows_name_by_code = (
        r for r in cat.names_by_code
        if term_match(r['str'], row['code_name'])
    )

    rows_code_by_name = (
        r for r in cat.codes_by_name
        if code_match(r['code'], row['code'], row['coding_system'])
    )

    try:
        cat.row = next(rows_name_by_code)
        if next(rows_code_by_name, None):
            cat.result = "BY_CODE_AND_NAME"
        else:
            cat.result = "NAME_BY_CODE"
        if next(rows_name_by_code, None):
            cat.comment = "not unique"
        return cat
    except:
        pass

    try:
        cat.row = next(rows_code_by_name)
        cat.result = "CODE_BY_NAME"
        if next(rows_code_by_name, None):
            cat.comment = "not unique"
        return cat
    except:
        pass

    name_cuis = {r['cui'] for r in cat.codes_by_name}
    code_cuis = {r['cui'] for r in cat.names_by_code}

    if row['concept']:
        rows = (r for r in cat.codes_by_name if r['cui'] == row['concept'])
        try:
            cat.row = next(rows)
            cat.result = "CODE_BY_CUI"
            if next(rows, None):
                cat.comment = "not unique"
            return cat
        except:
            pass

        try:
            rows = (r for r in cat.names_by_code if r['cui'] == row['concept'])
            cat.row = next(rows)
            cat.result = "CODE_NAME_BY_CUI"
            if next(rows, None):
                cat.comment = "not unique"
            return cat
        except:
            pass


    rows = (r for r in in_coding_system(cursor, row['code'], row['code_name']))
    try:
        cat.row = next(rows)
        if next(rows, None):
            cat.comment = "not unique"
        cat.result = "OTHER_CODING_SYSTEM"
        return cat
    except:
        pass

    rows = (r for r in cat.names_by_code if term_match_abbr(r['str'], row['code_name']))
    try:
        cat.row = next(rows)
        cat.result = "NAME_BY_CODE_ABBR"
        if next(rows, None):
            cat.comment = "not unique"
        return cat
    except:
        pass

    if name_cuis and code_cuis:
        if row['concept']:
            cat.result = "NONE_SAME_CUI"
        else:
            cat.result = "NONE_SAME_CUI_NO_CONCEPT"
        return cat

    cat.result = "NONE"
    return cat

CACHE = {}

def dedup(data, cursor, cursor_rcd):
    data["dedup_result"] = "-"
    data["dedup_comment"] = "-"
    data["dedup_code"] = "-"
    data["dedup_code_name"] = "-"
    data["dedup_coding_system"] = "-"
    data["dedup_changed"] = "-"
    data["dedup_ttys"] = "-"
    data["dedup_ignore"] = "-"
    data["dedup_names_by_code"] = "-"
    data["dedup_codes_by_name"] = "-"

    hist = {}
    count = 0
    for i, row in data.iterrows():
        # if count == 500:
        #     break
        # if row['coding_system'] != 'RCD2':
        #     continue
        count += 1
        if count % 100 == 0:
            print(".", end="", flush=True)

        global CACHE
        key = '-'.join(row[c] for c in KEY_COLUMNS)
        try:
            cat = CACHE[key]
        except:
            cat = categorize(cursor, cursor_rcd, row)
            CACHE[key] = cat

        if cat.result.startswith("NONE"):
            data.at[i, "dedup_result"]       = cat.result
        else:
            ignore = "?"
            if "ttys" in cat.row:
                ignore = "Y" if any(tty in IGNORE_TTYS for tty in cat.row["ttys"].split(",")) else "N"
            coding_system = cat.row["sab"] if "sab" in cat.row else row['coding_system']
            changed = []
            if row.dedup_original_code != cat.row["code"]:
                changed.append("code")
            if row.dedup_original_code_name != cat.row["str"]:
                changed.append("code_name")
            if "sab" in cat.row and row.coding_system != cat.row["sab"]:
                changed.append("coding_system")
            data.at[i, "dedup_result"]        = cat.result
            data.at[i, "dedup_code"]          = cat.row["code"]
            data.at[i, "dedup_code_name"]     = cat.row["str"]
            data.at[i, "dedup_coding_system"] = coding_system
            if changed:
                data.at[i, "dedup_changed"]   = '|'.join(changed)
            data.at[i, "dedup_ttys"]          = cat.row.get("ttys", "?")
            data.at[i, "dedup_ignore"]        = ignore

        if cat.names_by_code:
            data.at[i, 'dedup_names_by_code'] = '|'.join(
                r['str'] # f"{r['code']}:{r['str']}"
                for r in cat.names_by_code
            )

        if cat.codes_by_name:
            data.at[i, 'dedup_codes_by_name'] = '|'.join(
                r['code'] # f"{r['code']}:{r['str']}"
                for r in cat.codes_by_name
            )

        if cat.comment is not None:
            data.at[i, 'dedup_comment'] = cat.comment

    return data

def preprocess(data):
    def f(code):
        if 'E+' in code:
            return '{:.0f}'.format(float(code))
        return code
    data = data.fillna('')
    original_code = data.code.copy()
    original_code_name = data.code_name.copy()
    return (
        data
        .assign(code=data.code.map(f))
        .apply(lambda x: x.str.strip())
        .assign(dedup_original_code=original_code)
        .assign(dedup_original_code_name=original_code_name)
    )

def postprocess(data):
    return (
        data
        .assign(code=data.dedup_original_code)
        .assign(code_name=data.dedup_original_code_name)
    )

def dedup_one(data, cursor, cursor_rcd):
    data = preprocess(data)
    data = (
        data[
            "coding_system,code,code_name,concept,concept_name,dedup_original_code,dedup_original_code_name".split(",")] # event_abbreviation
        .drop_duplicates()
    )
    data = dedup(data, cursor, cursor_rcd)
    return postprocess(data)

def summarize(data):
    data = data[KEY_COLUMNS + DEDUP_COLS].drop_duplicates()
    print()
    print(
        data
        .dedup_result
        .value_counts()
        .to_frame()
        .assign(percentage=lambda df: df['count'] / df['count'].sum())
    )
    print()
    print(
        data[data.dedup_result == 'NONE']
        .coding_system
        .value_counts().to_frame()
    )
    # print()
    # print(
    #     data[data.dedup_result.str.startswith('NONE')]
    #     .fillna(0)
    #     .groupby(['coding_system', 'dedup_result'])
    #     .size()
    #     .reset_index()
    #     .pivot(columns='dedup_result', index='coding_system', values=applymap)
    #     .sort_values(by='NONE', ascending=False)
    #     .lambda(0 f: f"{f:.0f}" if f else "")
    # )

def main_dedup_one(input_filename, output_filename, conn, conn_rcd):
    data = pd.read_csv(input_filename, dtype=str)
    with conn_rcd.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor_rcd:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
            data = dedup_one(data, cursor, cursor_rcd)
    data.to_csv(output_filename, index=False)
    summarize(data)

class Data(namedtuple('Data', ['subdir', 'name', 'sheets', 'sheet_names', 'mapping_sheet_name'])):

    def mapping(self):
        return self.sheets[self.mapping_sheet_name]

def read_all(dirname, max):
    dfs = []
    for filename in sorted(glob(f'{dirname}/*/*.xlsx')):
        if len(dfs) == max:
            break
        subdir = filename[filename.index('/')+1:filename.rindex('/')]
        name = filename[filename.rindex('/')+1:filename.rindex('.')]
        xls = pd.ExcelFile(filename)
        sheets = pd.read_excel(filename, dtype=str, sheet_name=None)
        data = Data(subdir, name, {}, xls.sheet_names, None)
        for (sheet_name, df) in sheets.items():
            df.rename(lambda s: s.strip(), axis=1, inplace=True)
            data.sheets[sheet_name] = df
            try:
                col0 = df.columns[0]
            except IndexError:
                col0 = None
            if col0 == 'Coding system' and all(c in df.columns for c in INPUT_COLUMNS):
                if data.mapping_sheet_name is not None:
                    print(filename, "two sheets with coding systems:", data.mapping_sheet_name, ' and ', sheet_name)
                else:
                    data = data._replace(mapping_sheet_name = sheet_name)
        if data.mapping_sheet_name is None:
            print("mapping sheet not found in", filename)
        else:
            dfs.append(data)
    return dfs
        
def dedup_two(data, conn, conn_rcd):
    data = preprocess(data.rename(dict(zip(*COLUMN_MAPPING)), axis=1))
    with conn_rcd.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor_rcd:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
            data = dedup(data, cursor, cursor_rcd)
    return (
        postprocess(data)
        .rename(dict(zip(*reversed(COLUMN_MAPPING))), axis=1)
    )

YES_NO = {'N': 'No', 'Y': 'Yes'}

def dedup_modify_excel(data):
    data["Dedup ignore"] = "?"
    data["Dedup result"] = "-"
    data["Dedup details"] = "-"
    for i, row in data.iterrows():
        is_none = row["dedup_result"].startswith("NONE")
        details_list = []
        if is_none:
            result_cat = 'None'
        else:
            if row["dedup_changed"] == '-':
                result_cat = 'Confirmed'
            else:
                result_cat = 'Corrected'
                details_list.append(f'Original: {row["Coding system"]}|{row["dedup_original_code"]}|{row["dedup_original_code_name"]}')
            data.at[i, "Code"] = row["dedup_code"]
            data.at[i, "Code name"] = row["dedup_code_name"]
            data.at[i, "Coding system"] = row["dedup_coding_system"]
            data.at[i, "Dedup ignore"] = YES_NO[row["dedup_ignore"]]
        data.at[i, "Dedup result"] = f'{result_cat}: {RESULT_DETAILS[row["dedup_result"]]}'
        if row["dedup_comment"] != '-':
            details_list.append(f'Comment: {row["dedup_comment"]}')
        if is_none or row["dedup_comment"] != '-':
            if row["dedup_codes_by_name"] != '-':
                details_list.append(f'Codes by name: {row["dedup_codes_by_name"]}')
            if row["dedup_names_by_code"] != '-':
                details_list.append(f'Names by code: {row["dedup_names_by_code"]}')
        if details_list:
            data.at[i, "Dedup details"] = ', '.join(details_list)
    data.drop(DEDUP_COLS, axis=1, inplace=True)

def make_backup(in_dirname, out_dirname, subdir, name):
    # ["Reviews", "Review", "old", "Older versions", "Old", "OLD", "Old versions", "Older files"]
    backup_dir = f'{out_dirname}/{subdir}/Versions'
    os.makedirs(backup_dir, exist_ok=True)
    original = f'{in_dirname}/{subdir}/{name}.xlsx'
    backup = f'{backup_dir}/{name}-before-dedup.xlsx'
    shutil.copyfile(original, backup)

def write_dedup(out_dirname, data, mapping):
    filename = f"{out_dirname}/{data.subdir}/{data.name}.xlsx"
    with pd.ExcelWriter(filename) as writer:
        for sheet_name in data.sheet_names:
            if sheet_name == data.mapping_sheet_name:
                sheet = mapping
            else:
                sheet = data.sheets[sheet_name]
            sheet.to_excel(writer, sheet_name=sheet_name, index=False)

def main_dedup_two(in_dirname, out_dirname, datas, conn, conn_rcd):
    dedup_datas = []
    code_count = 0
    code_count_total = sum(len(data.mapping()) for data in datas)
    for (ix, data) in enumerate(datas):
        print()
        print(f"- {data.name} {ix}/{len(datas)} {code_count}/{code_count_total}")
        make_backup(in_dirname, out_dirname, data.subdir, data.name)
        mapping = data.mapping()
        mapping = dedup_two(mapping, conn, conn_rcd) 
        # data.to_csv(f"{out_dirname}/{data.subdir}/Versions/{data.name}-dedup.csv", index=False)
        code_count += len(mapping)
        dedup_datas.append(
            mapping[COLUMN_MAPPING[0] + DEDUP_COLS]
            .reset_index(drop=True)
        )
        dedup_modify_excel(mapping)
        write_dedup(out_dirname, data, mapping)
    dedup_data = pd.concat(dedup_datas).rename(dict(zip(*COLUMN_MAPPING)), axis=1)
    summarize(dedup_data)
    dedup_data.to_csv(f"{out_dirname}/all.csv", index=False)

def init_pool():
    global conn
    global conn_rcd
    conn = psycopg2.connect(database="umls2023aa")   
    conn_rcd = psycopg2.connect(database="umls-ext-mappings")   

def dedup_three(row):
    global conn
    global conn_rcd
    with conn_rcd.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor_rcd:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
            cat = categorize(cursor, cursor_rcd, row)
    return row | cat.to_record()

def main_dedup_three(datas, out_dirname):
    datas = (
        pd.concat([
            preprocess(
                data.mapping().rename(dict(zip(*COLUMN_MAPPING)), axis=1)
                ['coding_system code code_name concept concept_name'.split()]
            )
            for data in datas
        ], axis=1) 
        .drop_duplicates()
    )
    with mp.Pool(initializer=init_pool) as pool:
        dedup_data = pool.map(dedup_three, datas.to_dict('records'))
        # pool.join()
    dedup_data = pd.DataFrame.from_records(dedup_data)
    print(dedup_data)
    dedup_data.to_csv(f"{out_dirname}/all.csv", index=False)
    summarize(dedup_data)

if __name__ == "__main__":
    conn = psycopg2.connect(database="umls2023aa")   
    conn_rcd = psycopg2.connect(database="umls-ext-mappings")   
    in_dirname = sys.argv[1]
    out_dirname = sys.argv[2]
    try:
        max = int(sys.argv[3])
    except:
        max = None

    if max is None and os.path.exists('data.pickle'):
        with open("data.pickle", 'rb') as f:
            datas = pickle.load(f)
            print("Unpickled files")
    else:
        datas = read_all(in_dirname, max)

    if max is None and not os.path.exists('data.pickle'):
        with open("data.pickle", 'wb') as f:
            pickle.dump(datas, f)
            print("Pickled files", f)

    main_dedup_two(in_dirname, out_dirname, datas, conn, conn_rcd)

    # main_dedup_one(in_dirname, out_dirname, conn, conn_rcd)
    # main_dedup_three(datas, out_dirname)
