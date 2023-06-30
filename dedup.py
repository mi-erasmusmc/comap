import sys
import pandas as pd
import psycopg2
import psycopg2.extras
from collections import namedtuple
from unidecode import unidecode

# create table duplication_issues (
#     event_definition text,
#     coding_system text,
#     code_name text,
#     concept text,
#     concept_name text,
#     tags text,
#     system text,
#     event_abbreviation text,
#     type text,
#     code_rounding_issue text,
#     code_issue_dot text,
#     code text,
#     variable_name text,
#     dup text,
#     issue text
# );

def norm_str(str, wildchar):
    return unidecode(
        str
        .replace("'", wildchar)
        .replace(",", wildchar)
        .replace("/", wildchar)
    )

def term_match(str1, str2):
    def norm(str):
        return norm_str(
            str
            .replace("kidney", "KIDNEY")
            .replace("renal", "KIDNEY"),
            "-"
        )
    return norm(str1) == norm(str2)

def code_match(code1, code2, coding_system):
    def norm(code, coding_system):
        if coding_system == 'SNOMEDCT_US' or coding_system == 'SCTSPA':
            if len(code) == 17 and code[-2] == '0':
                return code[:-1] + '0'
        return code.strip('0').rstrip('.')
    return norm(code1, coding_system) == norm(code2, coding_system)

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

# CUI, STR, CODE, TTYS (on sab and codes)
def names_by_codes(cursor, sab, codes):
    query = f"""
    select cui, str, code, string_agg(tty,',') as ttys
    from mrconso
    where {sab_test(sab)}
    and code = any(%s)
    group by cui, str, code
    """
    cursor.execute(query, (sab, list(codes)))
    return [dict(r) for r in cursor.fetchall()]

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

# list(ctv3_conceptid) (on v2 code)
def rcd2_to_rcd3(cursor, code):
    query = f"""
    select v2_conceptid, ctv3_conceptid
    from ctv3rctmap_uk_20161001
    where v2_conceptid = %s
    and maptyp != 'n'
    and mapstatus = 1
    and isassured = 1
    and v2_conceptid not in ('_DRUG', '_NONE')
    order by v2_conceptid
    """
    cursor.execute(query, (code,))
    return [r['ctv3_conceptid'] for r in cursor.fetchall()]

# {ctv3_conceptid -> list(v2_conceptid)} (on ctv3 codes)
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
    

# name_codes: [{'code': ctv3_conceptid, ...}]
# returns [{'code': v2_conceptid, ...}]
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
        self.cat = None
        self.row = None
        self.names_by_code = None
        self.codes_by_name = None
        self.synonyms = None
        self.comment = None
    def __str__(self):
        return f"{self.cat}"

# row: {'coding_system': sab, 'code_name': str}
def categorize(cursor, cursor_rcd, row):
    cat = Categorization()
    is_rcd2 = row.coding_system == 'RCD2'
    if is_rcd2:
        codes = rcd2_to_rcd3(cursor_rcd, row.code)
    else:
        codes = [row.code]

    cat.names_by_code = names_by_codes(cursor, row.coding_system, codes)
    try:
        rows = (r for r in cat.names_by_code if term_match(r['str'], row.code_name))
        cat.row = next(rows)
        cat.cat = "NAME_BY_CODE"
        if next(rows, None):
            cat.comment = "not unique"
        return cat
    except:
        pass

    names_sab = 'RCD' if is_rcd2 else row.coding_system
    cat.codes_by_name = codes_by_name(cursor, names_sab, row.code_name)
    if is_rcd2:
        cat.codes_by_name = rcd3_to_rcd2_names(cursor_rcd, cat.codes_by_name)

    try:
        rows = (
            r for r in cat.codes_by_name for code in codes
            if code_match(r['code'], code, row.coding_system)
        )
        cat.row = next(rows)
        cat.cat = "CODE_BY_NAME"
        if next(rows, None):
            cat.comment = "not unique"
        return cat
    except:
        pass

    try:
        rows = (r for r in cat.codes_by_name if r['cui'] == row.concept)
        cat.row = next(rows)
        cat.cat = "CUI_BY_CODE"
        if next(rows, None):
            cat.comment = "not unique"
        return cat
    except:
        pass

    try:
        rows = (r for r in cat.names_by_code if r['cui'] == row.concept)
        cat.row = next(rows)
        cat.cat = "CUI_BY_NAME"
        if next(rows, None):
            cat.comment = "not unique"
        return cat
    except:
        pass

    cat.synonyms = synonyms_for_code_or_str(cursor, row.coding_system, row.code, row.code_name)
    try:
        rows = (
            r for r in cat.synonyms
            if term_match(r['syn_str'], row.code_name)
            or code_match(r['syn_code'], row.code, row.coding_system)
        )
        cat.row = next(rows)
        cat.cat = "SYNONYM"
        if next(rows, None):
            cat.comment = "not unique"
        return cat
    except:
        pass

    return cat

IGNORE_TTYS = set("AA,AD,AM,AS,AT,CE,EP,ES,ETAL,ETCF,ETCLIN,ET,EX,GT,IS,IT,LLTJKN1,LLTJKN,LLT,LO,MP,MTH_ET,MTH_IS,MTH_LLT,MTH_LO,MTH_OAF,MTH_OAP,MTH_OAS,MTH_OET,MTH_OET,MTH_OF,MTH_OL,MTH_OL,MTH_OPN,MTH_OP,OAF,OAM,OAM,OAP,OAS,OA,OET,OET,OF,OLC,OLG,OLJKN1,OLJKN1,OLJKN,OLJKN,OL,OL,OM,OM,ONP,OOSN,OPN,OP,PCE,PEP,PHENO_ET,PQ,PXQ,PXQ,SCALE,TQ,XQ".split(","))

conn = psycopg2.connect(database="umls2023aa")   
conn_rcd = psycopg2.connect(database="umls-ext-mappings")   

input_filename = sys.argv[1]
output_filename = sys.argv[2]

data = pd.read_csv(input_filename, dtype=str)

for i, row in data.iterrows():
    if 'E+' in row.code:
        code = '{:.0f}'.format(float(row.code))
        data.at[i, 'code'] = code



data = data["event_abbreviation,coding_system,code,code_name,concept,concept_name".split(",")]

data["dedup_reason"] = ""
data["dedup_code"] = ""
data["dedup_code_name"] = ""
data["dedup_diff"] = ""
data["dedup_ttys"] = ""
data["dedup_ignore"] = ""
data["dedup_names"] = ""
data["dedup_codes"] = ""
data["dedup_synonyms"] = ""
data["dedup_comment"] = ""

hist = {}
count = 0
with conn_rcd.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor_rcd:
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
        for i, row in data.iterrows():
            # if count == 20:
            #     break
            # if row['coding_system'] != 'RCD2':
            #     continue
            count += 1
            if count % 100 == 0:
                print(".", end="", flush=True)
            cat = categorize(cursor, cursor_rcd, row)

            if cat.cat is None:
                data.at[i, "dedup_reason"]       = "???"
            else:
                ignore = any(tty in IGNORE_TTYS for tty in cat.row["ttys"].split(","))
                changed = []
                if row.code != cat.row["code"]:
                    changed.append("code")
                if row.code_name != cat.row["str"]:
                    changed.append("code_name")
                data.at[i, "dedup_reason"]    = cat.cat
                data.at[i, "dedup_code"]      = cat.row["code"]
                data.at[i, "dedup_code_name"] = cat.row["str"]
                data.at[i, "dedup_changed"]   = '|'.join(changed) if changed else '-'
                data.at[i, "dedup_ttys"]      = cat.row["ttys"]
                data.at[i, "dedup_ignore"]    = "ignore" if ignore else ""
            if cat.names_by_code is not None:
                data.at[i, 'dedup_names'] = '|'.join(r['str'] for r in cat.names_by_code)
            if cat.codes_by_name is not None:
                data.at[i, 'dedup_codes'] = '|'.join(r['code'] for r in cat.codes_by_name)
            if cat.synonyms is not None:
                data.at[i, 'dedup_synonyms'] = '|'.join(f"{r['sab']}:{r['code']}:{r['str']}" for r in cat.synonyms)
            if cat.comment is not None:
                data.at[i, 'dedup_comment'] = cat.comment

conn.close()

print(
    data[data.dedup_reason != ""]
    ["coding_system code code_name concept concept_name dedup_reason".split()]
    .drop_duplicates()
    .dedup_reason
    .value_counts().to_frame("dedup_reason")
    .assign(percentage=lambda df: df.dedup_reason / df.dedup_reason.sum())
)
data.to_csv(output_filename, index=False)
