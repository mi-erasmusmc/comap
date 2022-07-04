
[//]: # (pandoc -s --metadata title="CodeMapper NEWS" --css style.css -i NEWS.md -o src/main/webapp/NEWS.html)

July 3, 2022
--------------

- update UMLS to version 2022AA
- optional download of descendant codes

June 10, 2022
--------------

Disabled descendant codes in download due to an server error in the SNOMED-CT API used by CodeMapper

May 1, 2022
--------------

Features

- include descendant codes when dowloading a mapping to a file (retrieved from the Snowstorm API for SNOMED-CT, and from the UMLS otherwise)
- download mappings as text file (tab-separated values/TSV)

Bug fixes

- descriptive message instead of error when creating the mapping before
  searching concepts

January 20, 2022
----------------

Feature

- (this) news page

Bug fix

- scroll only concepts grid, keep operation buttons and column headers

November 1, 2021
----------------

Bug fixes

- keep concept search constantly working
- prevent content trimming in embedding on vac4eu.org website
- sort projects and case definitions in overview
- avoid vertical scroll in mapping

October 19, 2021
----------------

Bug fix

- output each line of the textual case definition in an individual line during
  Excel export to obey limit on text size

April 2019
----------

Feature

- Administration interface

since 2019
----------

Development under the VAC4EU project.

2017
----

Published as

> Becker BFH, Avillach P, Romio S, van Mulligen EM, Weibel D, Sturkenboom MCJM,
> Kors J: CodeMapper: *Semi-automatic coding of case definitions. A contribution
> from the ADVANCE project.* Pharmacoepidemiology and Drug Safety 2017.
> <doi:10.1002/pds.4245>

2015 - 2018
-----------

Development under the IMI ADVANCE project at the Erasmus Medical Center,
Rotterdam.
