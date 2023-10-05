#!/usr/bin/env bash
set -Eeuo pipefail

if [ $# != 2 ]; then
    echo "Usage: $0 SNOMEDZIP DATABASE, found $#"
    exit 1
fi

SNOMEDZIP=$1
DATABASE=$2

SNOMEDDIR=$(basename "$SNOMEDZIP" .zip)
CONCEPT_WILD="$SNOMEDDIR/Snapshot/Terminology/sct2_Concept_*.txt"
RELATIONSHIP_WILD="$SNOMEDDIR/Snapshot/Terminology/sct2_Relationship_*.txt"
DESCRIPTION_WILD="$SNOMEDDIR/Snapshot/Terminology/sct2_Description_*.txt"
LANGUAGE_WILD="$SNOMEDDIR/Snapshot/Refset/Language/der2_cRefset_Language*.txt"

unzip "$SNOMEDZIP" "$CONCEPT_WILD" "$RELATIONSHIP_WILD" "$DESCRIPTION_WILD" "$LANGUAGE_WILD"

CONCEPT=$(eval echo $CONCEPT_WILD)
DESCRIPTION=$(eval echo $DESCRIPTION_WILD)
RELATIONSHIP=$(eval echo $RELATIONSHIP_WILD)
LANGUAGE=$(eval echo $LANGUAGE_WILD)

TRANSITIVECLOSURE=$(echo "$RELATIONSHIP"|sed 's/_Relationship_/_TransitiveClosure_/')
rm -f "$TRANSITIVECLOSURE"
echo "generating transitive closure"
java com.wcinformatics.snomed.TransitiveClosureGenerator \
  "$RELATIONSHIP" "$TRANSITIVECLOSURE" 

cat psql_tables.sql \
  | sed "s|{{CONCEPT}}|$CONCEPT|" \
  | sed "s|{{DESCRIPTION}}|$DESCRIPTION|" \
  | sed "s|{{LANGUAGE}}|$LANGUAGE|" \
  | sed "s|{{TRANSITIVECLOSURE}}|$TRANSITIVECLOSURE|" \
  | sudo -u postgres psql "$DATABASE"

rm -rf "$SNOMEDDIR"
