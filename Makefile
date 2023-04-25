.PHONY: deploy-dev deploy-testing deploy-production

SERVER=advance
LOCAL_TOMCAT=/var/lib/tomcat9/

deploy-production:
	mvn -P production clean package
	scp target/codemapper.war $(SERVER):/tmp/
	ssh -t $(SERVER) make deploy-production

deploy-testing:
	mvn -P testing clean package
	scp target/codemapper-testing.war $(SERVER):/tmp/
	ssh -t $(SERVER) make deploy-testing

deploy-dev:
	mvn -P dev package
	sudo -u tomcat cp target/codemapper-dev.war $(LOCAL_TOMCAT)/webapps
