drop table if exists users;

create table users (
  id int not null auto_increment,  
  username char(100) not null unique,
  password char(64) not null,
  primary key (id)
);

insert into users (id, username, password) values
(1, "admin", "fc8252c8dc55839967c58b9ad755a59b61b67c13227ddae4bd3f78a38bf394f7"),
(2, "user1", "0a041b9462caa4a31bac3567e0b6e6fd9100787db2ab433d96f6d178cabfce90"),
(3, "user2", "6025d18fe48abd45168528f18a82e265dd98d421a7084aa09f61b341703901a3"),
(4, "user3", "b4e8183bc3773e785982918eefcab56eb390b2582a06812739d97d944830293f");

drop table if exists projects;

create table projects (
  id int not null auto_increment,
  name char(100) not null unique,
  primary key (id)
);

insert into projects (id, name) values
(1, "EMIF"),
(2, "ADVANCE");

drop table if exists users_projects;

create table users_projects (
  user_id int not null references users(id),
  project_id int not null references projects(id)
);

insert into users_projects (user_id, project_id) values
(2, 1),
(2, 2),
(3, 1),
(4, 2);

drop table if exists case_definitions;

create table case_definitions (
  project_id int not null references projects(id),
  name char(255) not null,
  state text not null,
  primary key (project_id, name)
);
