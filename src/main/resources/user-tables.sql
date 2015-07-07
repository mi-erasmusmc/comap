drop table if exists users;

create table users (
  id int not null auto_increment,  
  username char(100) not null unique,
  password char(64) not null,
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
  unique (user_id, project_id)
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

drop table if exists comments;

create table comments (
  id int not null auto_increment primary key,
  `timestamp` TIMESTAMP not null default CURRENT_TIMESTAMP,
  case_definition_id int not null references case_definitions(id),
  cui char(8) not null,
  author int not null references users(id),
  content mediumtext not null
);