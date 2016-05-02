# ADVANCE Code Mapper

Using servlet 3.0.1 -- requires Tomcat7

# Database
## Migration

```shell
mysqldump --user=root --host=127.0.0.1 --port=3307 --default-character-set=utf8 "code-mapper" -p > code-mapper.sql
mysql -u root -h 127.0.0.1 -P 3307 -p < code-mapper.sql
```