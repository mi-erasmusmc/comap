import sys
import pandas as pd
import psycopg2
import psycopg2.extras
from collections import namedtuple
from unidecode import unidecode

def norm_str(str, wildcard):
    if wildcard:
        str = (str
            .replace("-", wildcard)
            .replace("'", wildcard)
            .replace(",", wildcard)
            .replace("/", wildcard))
    return unidecode(str)

def term_norm(str):
    str = (str
           .replace("kidney", "KIDNEY")
           .replace("renal", "KIDNEY"))
    return norm_str(str, "_")

def term_match(str1, str2):
    return term_norm(str1) == term_norm(str2)

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
    codes_v2 = [r['code'] for r in cursor_rcd.fetchall()]

    codes_ctv3 = rcd2_to_rcd3(cursor_rcd, codes_v2)
    codes_ctv3 = [c for cs in codes_ctv3.values() for c in cs]

    cuis = cuis_of_codes(cursor, "RCD", codes_ctv3)

    return [
        {'cui': cui, 'code': code, 'str': str}
        for code in codes_v2 for cui in cuis
    ]

def cuis_of_codes(cursor, sab, codes):
    query = f"""
    select distinct cui
    from mrconso
    where sab = %s
    and code = any(%s)
    """
    cursor.execute(query, (sab, codes))
    return [r["cui"] for r in cursor.fetchall()]

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
    strs = [r['description'] for r in cursor_rcd.fetchall()]

    codes_ctv3 = rcd2_to_rcd3(cursor_rcd, list(code))
    codes_ctv3 = [c for cs in codes_ctv3.values() for c in cs]
    cuis = cuis_of_codes(cursor, "RCD", codes_ctv3)

    return [
        {'cui': cui, 'str': str, 'code': code}
        for str in strs for cui in cuis
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

# row: {'coding_system': sab, 'code': str, 'code_name': str}
def categorize(cursor, cursor_rcd, row):

    cat = Categorization()

    if row.coding_system == "MEDCODEID":
        cat.result = "NONE_CUSTOM"
        return cat

    is_rcd2 = row.coding_system == 'RCD2'
    # if is_rcd2:
    #     names_sab = 'RCD'
    #     codes = rcd2_to_rcd3(cursor_rcd, row.code)
    # else:
    #     names_sab = row.coding_system
    #     codes = [row.code]

    if is_rcd2:
        cat.names_by_code = names_by_codes_rcd2(cursor, cursor_rcd, row.code)
    else:
        cat.names_by_code = names_by_codes(cursor, row.coding_system, row.code)

    try:
        rows = (r for r in cat.names_by_code if term_match(r['str'], row.code_name))
        cat.row = next(rows)
        cat.result = "NAME_BY_CODE"
        if next(rows, None):
            cat.comment = "not unique"
        return cat
    except:
        pass

    if is_rcd2:
        cat.codes_by_name = codes_by_name_rcd2(cursor, cursor_rcd, row.code_name)
    else:
        cat.codes_by_name = codes_by_name(cursor, row.coding_system, row.code_name)

    try:
        rows = (
            r for r in cat.codes_by_name
            if code_match(r['code'], row.code, row.coding_system)
        )
        cat.row = next(rows)
        cat.result = "CODE_BY_NAME"
        if next(rows, None):
            cat.comment = "not unique"
        return cat
    except:
        pass

    name_cuis = {r['cui'] for r in cat.codes_by_name}
    code_cuis = {r['cui'] for r in cat.names_by_code}

    if row.concept:
        try:
            rows = (r for r in cat.codes_by_name if r['cui'] == row.concept)
            cat.row = next(rows)
            cat.result = "CUI_BY_CODE"
            if next(rows, None):
                cat.comment = "not unique"
            return cat
        except:
            pass

        try:
            rows = (r for r in cat.names_by_code if r['cui'] == row.concept)
            cat.row = next(rows)
            cat.result = "CUI_BY_NAME"
            if next(rows, None):
                cat.comment = "not unique"
            return cat
        except:
            pass

        if name_cuis and code_cuis:
            cat.result = "NONE_CONCEPT_SAME_CUI"
            return cat

    elif name_cuis and code_cuis:
        cat.result = "NONE_NO_CONCEPT_SAME_CUI"
        return cat

    cat.result = "NONE"
    return cat

IGNORE_TTYS = set("AA AD AM AS AT CE EP ES ETAL ETCF ETCLIN ET EX GT IS IT LLTJKN1 LLTJKN LLT LO MP MTH_ET MTH_IS MTH_LLT MTH_LO MTH_OAF MTH_OAP MTH_OAS MTH_OET MTH_OET MTH_OF MTH_OL MTH_OL MTH_OPN MTH_OP OAF OAM OAM OAP OAS OA OET OET OF OLC OLG OLJKN1 OLJKN1 OLJKN OLJKN OL OL OM OM ONP OOSN OPN OP PCE PEP PHENO_ET PQ PXQ PXQ SCALE TQ XQ".split())

def read_duplication_issues(filename):
    data = pd.read_csv(filename, dtype=str)
    for i, row in data.iterrows():
        if 'E+' in row.code:
            code = '{:.0f}'.format(float(row.code))
            data.at[i, 'code'] = code
    return (
        data["coding_system,code,code_name,concept,concept_name".split(",")] # event_abbreviation
        .drop_duplicates()
    )

def dedup(data, cursor, cursor_rcd):
    data["dedup_result"] = ""
    data["dedup_comment"] = ""
    data["dedup_code"] = ""
    data["dedup_code_name"] = ""
    data["dedup_diff"] = ""
    data["dedup_ttys"] = ""
    data["dedup_ignore"] = ""
    data["dedup_names_by_code"] = ""
    data["dedup_codes_by_name"] = ""

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
        cat = categorize(cursor, cursor_rcd, row)

        if cat.result.startswith("NONE"):
            data.at[i, "dedup_result"]       = cat.result
        else:
            ignore = "?"
            if "ttys" in cat.row:
                ignore = "Y" if any(tty in IGNORE_TTYS for tty in cat.row["ttys"].split(",")) else "N"
            changed = []
            if row.code != cat.row["code"]:
                changed.append("code")
            if row.code_name != cat.row["str"]:
                changed.append("code_name")
            data.at[i, "dedup_result"]    = cat.result
            data.at[i, "dedup_code"]      = cat.row["code"]
            data.at[i, "dedup_code_name"] = cat.row["str"]
            data.at[i, "dedup_changed"]   = '|'.join(changed) if changed else '-'
            data.at[i, "dedup_ttys"]      = cat.row.get("ttys", "?")
            data.at[i, "dedup_ignore"]    = ignore

        if cat.names_by_code is not None:
            data.at[i, 'dedup_names_by_code'] = '|'.join(
                r['str'] # f"{r['code']}:{r['str']}"
                for r in cat.names_by_code
            )

        if cat.codes_by_name is not None:
            data.at[i, 'dedup_codes_by_name'] = '|'.join(
                r['code'] # f"{r['code']}:{r['str']}"
                for r in cat.codes_by_name
            )

        if cat.comment is not None:
            data.at[i, 'dedup_comment'] = cat.comment

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

    return data

def main():
    input_filename = sys.argv[1]
    output_filename = sys.argv[2]
    data = read_duplication_issues(input_filename)
    with conn_rcd.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor_rcd:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
            data = dedup(data, cursor, cursor_rcd)
    data.to_csv(output_filename, index=False)

conn = psycopg2.connect(database="umls2023aa")   
conn_rcd = psycopg2.connect(database="umls-ext-mappings")   

if __name__ == "__main__":
    main()
