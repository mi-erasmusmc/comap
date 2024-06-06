drop table if exists users;

create table users (
  id int not null auto_increment,  
  username char(100) not null unique,
  password char(64) not null,
  email text,
  anonymous boolean default false,
  primary key (id)
);

insert into users (id, username, password) values
(1, "admin", "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918"),
(2, "user1", "0a041b9462caa4a31bac3567e0b6e6fd9100787db2ab433d96f6d178cabfce90"),
(3, "user2", "6025d18fe48abd45168528f18a82e265dd98d421a7084aa09f61b341703901a3"),
(4, "user3", "5860faf02b6bc6222ba5aca523560f0e364ccd8b67bee486fe8bf7c01d492ccb");

drop table if exists projects;

create table projects (
  id int not null auto_increment,
  name char(100) not null unique,
  primary key (id)
);

insert into projects (id, name) values
(1, "ADVANCE"),
(2, "EMIF");

drop table if exists users_projects;

create table users_projects (
  user_id int not null references users(id),
  project_id int not null references projects(id),
  -- E: editor, C: commentator
  role char(1) not null,
  unique (user_id, project_id, role)
);

insert into users_projects (user_id, project_id) values
(2, 1),
(2, 2),
(3, 1),
(4, 2);

drop table if exists case_definitions;

create table case_definitions (
  id int not null auto_increment,
  project_id int not null references projects(id),
  name char(255) not null,
  state mediumtext not null,
  unique (project_id, name),
  primary key (id)
);

drop view if exists projects_case_definitions;
create view projects_case_definitions
as
  select
    p.id project_id,
    p.name project_name,
    cd.id case_definition_id,
    cd.name case_definition_name
  from projects p
  join case_definitions cd
  on p.id = cd.project_id
  order by project_name, case_definition_name;

drop table if exists case_definition_revisions;
create table case_definition_revisions (
  id serial primary key,
  case_definition_id int not null references case_definitions(id),
  version int not null, -- unique serial per case_definition_id
  user_id int not null references users(id),
  timestamp TIMESTAMP not null default CURRENT_TIMESTAMP,
  summary text not null,
  mapping jsonb not null,
  constraint case_definition_version UNIQUE (case_definition_id, version)
);

create or replace function set_revision_version()
returns trigger as $$
begin
  new.version = coalesce((
    select max(version)
    from case_definition_revisions
    where case_definition_id = new.case_definition_id
  ), 0) + 1;
  return new;
end;
$$ language plpgsql;

create trigger set_revision_version_trigger
create trigger set_revision_version_trigger
before insert on case_definition_revisions
for each row
execute procedure set_revision_version();

create index case_definition_revisions_case_definition_id on case_definition_revisions(case_definition_id);
create index case_definition_revisions_timestamp on case_definition_revisions(timestamp);
create index case_definition_revisions_version on case_definition_revisions(version);
before insert on case_definition_revisions
for each row
execute procedure set_revision_version();

create index case_definition_revisions_case_definition_id on case_definition_revisions(case_definition_id);
create index case_definition_revisions_timestamp on case_definition_revisions(timestamp);
create index case_definition_revisions_version on case_definition_revisions(version);

alter table case_definitions alter column state drop not null;
alter table users add column anonymous boolean default false;
