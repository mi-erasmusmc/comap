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

drop table if exists review_topic cascade;
create table review_topic (
  id serial primary key,
  case_definition_id int not null references case_definitions(id),
  cui char(8) not null,
  heading text,
  created_by int references users(id),
  created_at TIMESTAMP not null default CURRENT_TIMESTAMP,
  resolved boolean not null default false,
  resolved_by int references users(id),
  resolved_at TIMESTAMP
);

-- mark a topic as resolved by a given user
drop function if exists review_resolve_topic;
create function review_resolve_topic(topic_id int, username text) returns boolean
language plpgsql as $$ begin
update
  review_topic
set
  resolved = true,
  resolved_by = u.id,
  resolved_at = now()
from
  users as u
where
  review_topic.id = review_resolve_topic.topic_id
and
  u.username = review_resolve_topic.username;
return found;
end; $$; 

-- delete all read-markers of messages for a (resolved) topic
drop function if exists review_reset_mark_read;
create function review_reset_mark_read(topic_id int) returns void
as $$
delete from review_message_is_read
where message_id in
( select id
  from review_message
  where topic_id = review_reset_mark_read.topic_id )
$$ language sql;

drop table if exists review_message cascade;
create table review_message (
  id serial primary key,
  topic_id int not null references review_topic(id),
  timestamp TIMESTAMP not null default CURRENT_TIMESTAMP,
  author_id int not null references users(id),
  content text not null
);

-- create a new message
drop function if exists review_new_message;
create function review_new_message(project text, casedef text, cui char(8), topic_id int, content text, username text)
returns table (message_id int) as $$
with
  message as (
    insert into review_message (topic_id, author_id, content)
    select review_new_message.topic_id, a.id, review_new_message.content
    from users a
    where a.username = review_new_message.username
    returning id
  ),
  x as (
    insert into review_message_is_read (message_id, user_id)
    select m.id, u.id
    from message m, users u
    where u.username = review_new_message.username
  )
  select * from message
$$ language sql;

-- create a new topic
drop function if exists review_new_topic;
create function review_new_topic(project text, casedef text, cui char(8), heading text, username text) returns table (topic_id int)
as $$
  insert into review_topic (case_definition_id, cui, heading, created_by)
  select cd.id, review_new_topic.cui, review_new_topic.heading, u.id
  from projects p
  inner join case_definitions cd on cd.project_id = p.id
  inner join users u on u.username = review_new_topic.username
  where p.name = review_new_topic.project and cd.name = review_new_topic.casedef
  returning id
$$ language sql;


drop table if exists review_message_is_read;
create table review_message_is_read (
  message_id int not null references review_message(id),
  user_id int not null references users(id),
  constraint primary_keys primary key (message_id, user_id)
);

-- mark all messages of a topic read for a given user
drop function if exists review_mark_topic_read;
create function review_mark_topic_read(topic_id int, username text) returns void
language plpgsql as $$ begin
  insert into review_message_is_read (message_id, user_id)
  select m.id, u.id
  from review_message m, users u
  where m.topic_id = review_mark_topic_read.topic_id
  and u.username = review_mark_topic_read.username
  on conflict on constraint primary_keys do nothing;
end; $$; 

-- get all messages
drop function if exists review_all_messages;
create function review_all_messages(project text, casedef text, username text)
  returns table (
    cui char(8), topic_id int, topic_heading text,
    created_by text, created_at TIMESTAMP,
    resolved boolean, resolved_user text, resolved_timestamp TIMESTAMP,
    message_id int, message_author text, message_timestamp TIMESTAMP, message_content text,
    is_read boolean
  ) as $$
    select
      t.cui, t.id, t.heading,
      cu.username, t.created_at,
      t.resolved, ru.username, t.resolved_at,
      m.id, mu.username, m.timestamp, m.content,
      r.message_id is not null
    from projects p
    inner join case_definitions c on c.project_id = p.id
    inner join review_topic t on t.case_definition_id = c.id
    left join users cu on cu.id = t.created_by
    left join review_message m on m.topic_id = t.id
    left join users mu on mu.id = m.author_id
    left join users ru on ru.username = review_all_messages.username
    left join review_message_is_read r on (r.message_id = m.id and r.user_id = ru.id)
    where p.name = review_all_messages.project
    and c.name = review_all_messages.casedef
    order by t.cui, t.id, m.timestamp;
$$ language sql;

drop function if exists review_topic_created_by;
create function review_topic_created_by(topic_id int)
returns text
as $$
select u.username
from review_topic t
inner join users u on u.id = t.created_by 
where t.id = review_topic_created_by.topic_id
$$ language sql;

drop function if exists review_migrate_from_comments;
create function review_migrate_from_comments() returns void
as $$

insert into review_topic (case_definition_id, cui, created_by, created_at, heading)
select distinct c.case_definition_id, c.cui, c.author, c.timestamp, 'Comment' as heading
from "code-mapper".comments c
inner join case_definitions cd
on c.case_definition_id = cd.id;

insert into review_message (topic_id, timestamp, author_id, content)
select t.id as topic_id, c.timestamp, c.author, c.content
from "code-mapper".comments as c, review_topic as t
where c.case_definition_id = t.case_definition_id
and c.cui = t.cui;

$$ language sql;
