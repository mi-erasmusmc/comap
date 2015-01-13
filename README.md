# Dependencies for jaxws plugin

## Eclipse

Install [https://code.google.com/p/jaxws-maven-connector/](jaxws maven connector) ([http://jaxws-maven-connector.googlecode.com/svn/trunk/jaxws-connector-update-site](update site)).

## Command line

To compile from command line you may need to

```shell
$ mvn archetype:generate -DgroupId=org.eclipse.m2e -DartifactId=lifecycle-mapping -Dversion=1.0.0 -DarchetypeArtifactId=maven-archetype-mojo
$ cd lifecycle-mapping
$ mvn install
```