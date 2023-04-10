#!/usr/bin/env bash
set -Eeuo pipefail

if [ $# != 3 ]; then
    echo "Usage: $0 SNOMEDZIP_INT SNOMEDZIP_NAT DATABASE"
    exit 1
fi

# combine the internation version with a national version (i.e. spanish)

SNOMEDZIP1=$1
SNOMEDZIP2=$2
DATABASE=$3

SNOMEDDIR1=$(basename "$SNOMEDZIP1" .zip)
SNOMEDDIR2=$(basename "$SNOMEDZIP2" .zip)

CONCEPT_WILD1="$SNOMEDDIR1/Snapshot/Terminology/sct2_Concept_*.txt"
RELATIONSHIP_WILD1="$SNOMEDDIR1/Snapshot/Terminology/sct2_Relationship_*.txt"
DESCRIPTION_WILD1="$SNOMEDDIR1/Snapshot/Terminology/sct2_Description_*.txt"
LANGUAGE_WILD1="$SNOMEDDIR1/Snapshot/Refset/Language/der2_cRefset_Language*.txt"
[ -e "$SNOMEDDIR1" ] || unzip "$SNOMEDZIP1" "$CONCEPT_WILD1" "$RELATIONSHIP_WILD1" "$DESCRIPTION_WILD1" "$LANGUAGE_WILD1"

CONCEPT_WILD2="$SNOMEDDIR2/Snapshot/Terminology/sct2_Concept_*.txt"
RELATIONSHIP_WILD2="$SNOMEDDIR2/Snapshot/Terminology/sct2_Relationship_*.txt"
DESCRIPTION_WILD2="$SNOMEDDIR2/Snapshot/Terminology/sct2_Description_*.txt"
LANGUAGE_WILD2="$SNOMEDDIR2/Snapshot/Refset/Language/der2_cRefset_Language*.txt"
[ -e "$SNOMEDDIR2" ] || unzip "$SNOMEDZIP2" "$CONCEPT_WILD2" "$RELATIONSHIP_WILD2" "$DESCRIPTION_WILD2" "$LANGUAGE_WILD2"

CONCEPT1=$(eval echo $CONCEPT_WILD1)
DESCRIPTION1=$(eval echo $DESCRIPTION_WILD1)
RELATIONSHIP1=$(eval echo $RELATIONSHIP_WILD1)
LANGUAGE1=$(eval echo $LANGUAGE_WILD1)

CONCEPT2=$(eval echo $CONCEPT_WILD2)
DESCRIPTION2=$(eval echo $DESCRIPTION_WILD2)
RELATIONSHIP2=$(eval echo $RELATIONSHIP_WILD2)
LANGUAGE2=$(eval echo $LANGUAGE_WILD2)

CONCEPT3="$CONCEPT2-combined"
DESCRIPTION3="$DESCRIPTION2-combined"
RELATIONSHIP3="$RELATIONSHIP2-combined"
LANGUAGE3="$LANGUAGE-combined"

[ -e "$CONCEPT3" ] || (cat "$CONCEPT1"; grep -vP '^id\t' "$CONCEPT2") > "$CONCEPT3"
[ -e "$DESCRIPTION3" ] || (cat "$DESCRIPTION1"; grep -vP '^id\t' "$DESCRIPTION2") > "$DESCRIPTION3"
[ -e "$RELATIONSHIP3" ] || (cat "$RELATIONSHIP1"; grep -vP '^id\t' "$RELATIONSHIP2") > "$RELATIONSHIP3"
[ -e "$LANGUAGE3" ] || (cat "$LANGUAGE1"; grep -vP '^id\t' "$LANGUAGE2") > "$LANGUAGE3"

TRANSITIVECLOSURE=$(echo "$RELATIONSHIP2"|sed 's/_Relationship_/_TransitiveClosure_/')
rm -f "$TRANSITIVECLOSURE"
echo "generating transitive closure"
java com.wcinformatics.snomed.TransitiveClosureGenerator \
  "$RELATIONSHIP3" "$TRANSITIVECLOSURE" 

cat psql_tables.sql \
  | sed "s|{{CONCEPT}}|$CONCEPT3|" \
  | sed "s|{{DESCRIPTION}}|$DESCRIPTION3|" \
  | sed "s|{{LANGUAGE}}|$LANGUAGE3|" \
  | sed "s|{{TRANSITIVECLOSURE}}|$TRANSITIVECLOSURE|" \
  | sudo -u postgres psql "$DATABASE"
