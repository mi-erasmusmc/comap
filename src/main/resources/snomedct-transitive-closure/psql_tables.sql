-- Concept file.
DROP TABLE IF EXISTS concept CASCADE;
CREATE TABLE concept (
    id NUMERIC(20) NOT NULL PRIMARY KEY,
    effectiveTime DATE NOT NULL,
    active BOOLEAN NOT NULL,
    moduleId NUMERIC(20) NOT NULL,
    definitionStatusId NUMERIC(20) NOT NULL,
    FOREIGN KEY (moduleId) REFERENCES concept(id),
    FOREIGN KEY (definitionStatusId) REFERENCES concept(id)
);

\copy concept FROM '{{CONCEPT}}' WITH DELIMITER E'\t' QUOTE E'\\' ENCODING 'UTF8' CSV HEADER;

CREATE INDEX x_concept_id ON concept(id);

-- Description file.
DROP TABLE IF EXISTS description CASCADE;
CREATE TABLE description (
    id NUMERIC(20) NOT NULL PRIMARY KEY,
    effectiveTime DATE NOT NULL,
    active BOOLEAN NOT NULL,
    moduleId NUMERIC(20) NOT NULL,
    conceptId NUMERIC(20) NOT NULL,
    languageCode CHAR(2) NOT NULL,
    typeId NUMERIC(20) NOT NULL,
    term VARCHAR(255) NOT NULL,
    caseSignificanceId NUMERIC(20) NOT NULL,
    FOREIGN KEY (moduleId) REFERENCES concept(id),
    FOREIGN KEY (conceptId) REFERENCES concept(id),
    FOREIGN KEY (typeId) REFERENCES concept(id),
    FOREIGN KEY (caseSignificanceId) REFERENCES concept(id)
);

\copy description FROM '{{DESCRIPTION}}' WITH DELIMITER E'\t' QUOTE E'\\' ENCODING 'UTF8' CSV HEADER;

CREATE INDEX x_description_id ON description(id);

-- Language refset file.
DROP TABLE IF EXISTS language CASCADE;
CREATE TABLE language (
    id CHAR(52) NOT NULL PRIMARY KEY,
    effectiveTime DATE NOT NULL,
    active BOOLEAN NOT NULL,
    moduleId NUMERIC(20) NOT NULL,
    refsetId NUMERIC(20) NOT NULL,
    referencedComponentId NUMERIC(20) NOT NULL,
    acceptabilityId NUMERIC(20) NOT NULL,
    FOREIGN KEY (moduleId) REFERENCES concept(id),
    FOREIGN KEY (refsetId) REFERENCES concept(id),
    FOREIGN KEY (acceptabilityId) REFERENCES concept(id)
);

\copy language FROM '{{LANGUAGE}}' WITH DELIMITER E'\t' QUOTE E'\\' ENCODING 'UTF8' CSV HEADER;

CREATE INDEX x_language_refercompid ON language(referencedComponentId);

DROP VIEW IF EXISTS conceptpreferredname;
CREATE VIEW conceptpreferredname AS
SELECT c.id conceptId, NULLIF(d.term, 'no active preferred synonym') preferredName, d.id descriptionId
FROM concept c
LEFT OUTER JOIN description d
ON c.id = d.conceptId
AND d.active = TRUE
AND d.typeId = 900000000000013009
LEFT OUTER JOIN language l
ON d.id = l.referencedComponentId
AND l.active = TRUE
AND l.acceptabilityId = 900000000000548007
AND l.refSetId = 900000000000509007
WHERE (l.acceptabilityId IS NOT null OR d.TERM IS null);

-- Transitive closure table.
DROP TABLE IF EXISTS transitiveclosure CASCADE;
CREATE TABLE transitiveclosure (
    superTypeId NUMERIC(20) NOT NULL,
    subTypeId NUMERIC(20) NOT NULL,
    depth INT NOT NULL,
    PRIMARY KEY (superTypeId, subTypeId),
    FOREIGN KEY (superTypeId) REFERENCES concept(id),
    FOREIGN KEY (subTypeId) REFERENCES concept(id)
);

\copy transitiveclosure FROM '{{TRANSITIVECLOSURE}}' WITH DELIMITER E'\t' QUOTE E'\\' ENCODING 'UTF8' CSV HEADER;

CREATE INDEX x_transitive_closure_supertypeid ON transitiveclosure(supertypeid);
