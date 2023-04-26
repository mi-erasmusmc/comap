-- see UPGRADE-UMLS.md in the root directory on usage

DROP TABLE IF EXISTS mrdef;
CREATE TABLE mrdef (
  cui char(8) NOT NULL,
  aui varchar(9) NOT NULL,
  atui varchar(11) NOT NULL,
  satui varchar(50),
  sab varchar(40) NOT NULL,
  def text NOT NULL,
  suppress char(1) NOT NULL,
  cvf bigint,
  dummy char(1)
);
DROP TABLE IF EXISTS mrsab;
CREATE TABLE mrsab (
  vcui char(8),
  rcui char(8),
  vsab varchar(40) NOT NULL,
  rsab varchar(40) NOT NULL,
  son text NOT NULL,
  sf varchar(40) NOT NULL,
  sver varchar(40),
  vstart char(8),
  vend char(8),
  imeta varchar(10) NOT NULL,
  rmeta varchar(10),
  slc text,
  scc text,
  srl bigint NOT NULL,
  tfr bigint,
  cfr bigint,
  cxty varchar(50),
  ttyl varchar(400),
  atnl text,
  lat varchar(3),
  cenc varchar(40) NOT NULL,
  curver char(1) NOT NULL,
  sabin char(1) NOT NULL,
  ssn text NOT NULL,
  scit text NOT NULL,
  dummy char(1)
);
DROP TABLE IF EXISTS mrsty;
CREATE TABLE mrsty (
  cui char(8) NOT NULL,
  tui varchar(4) NOT NULL,
  stn varchar(100), --  NOT NULL
  sty varchar(50),  --  NOT NULL
  atui varchar(11), --  NOT NULL
  cvf bigint,
  dummy char(1)
);
DROP TABLE IF EXISTS mrrel;
CREATE TABLE mrrel (
  cui1 char(8), --  NOT NULL
  aui1 varchar(9),
  stype1 varchar(50), --  NOT NULL
  rel varchar(4) NOT NULL,
  cui2 character(8) NOT NULL,
  aui2 varchar(9),
  stype2 varchar(50), --  NOT NULL
  rela varchar(100),
  rui varchar(10) NOT NULL,
  srui varchar(50),
  sab varchar(40), --  NOT NULL
  sl varchar(40), --  NOT NULL
  rg varchar(10),
  dir varchar(1),
  suppress char(1) NOT NULL,
  cvf bigint,
  dummy char(1)
);
DROP TABLE IF EXISTS mrconso;
CREATE TABLE mrconso (
  cui      char(8) NOT NULL,
  lat      char(3) NOT NULL,
  ts       char(1) NOT NULL,
  lui      char(9) NOT NULL,
  stt      varchar(3) NOT NULL,
  sui      char(9) NOT NULL,
  ispref   char(1) NOT NULL,
  aui      varchar(9) NOT NULL,
  saui     varchar(50),
  scui     varchar(50),
  sdui     varchar(50),
  sab      varchar(20) NOT NULL,
  tty      varchar(20) NOT NULL,
  code     varchar(100) NOT NULL,
  str      text NOT NULL,
  srl      int NOT NULL,
  suppress char(1) NOT NULL,
  cvf      int,
  dummy    char(1)
);
drop table if exists transitiveclosure;
create table transitiveclosure (
sup char(9) not null,
sub char(9) not null
);
