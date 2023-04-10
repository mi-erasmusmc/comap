
deploy-production:
	mvn -P testing clean package
	scp target/codemapper-testing.war advance:/tmp/
	ssh -t advance make deploy-production

deploy-testing:
	mvn -P testing clean package
	scp target/codemapper-testing.war advance:/tmp/
	ssh -t advance make deploy-testing

deploy-dev:
	mvn -P dev package
	sudo -u tomcat cp target/codemapper-dev.war /var/lib/tomcat9/webapps
