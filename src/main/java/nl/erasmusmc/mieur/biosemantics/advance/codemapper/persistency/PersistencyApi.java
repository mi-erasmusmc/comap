package nl.erasmusmc.mieur.biosemantics.advance.codemapper.persistency;

import java.io.IOException;
import java.io.StringReader;
import java.nio.charset.Charset;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.Collections;
import java.util.LinkedList;
import java.util.List;
import java.util.regex.Pattern;

import javax.json.Json;
import javax.json.JsonException;

import org.apache.log4j.Logger;

public class PersistencyApi {

	private static Logger logger = Logger.getLogger("CodeMapperWebService");

	private static final String CASE_DEFINITIONS_FOLDER = "case-definitions";
	private static final String JSON_SUFFIX = ".json";
	private Path caseDefinitionsPath;

	public PersistencyApi(Path directory) throws IOException {
		this.caseDefinitionsPath = directory.resolve(CASE_DEFINITIONS_FOLDER);
		System.out.println(caseDefinitionsPath.toAbsolutePath());
		if (!Files.exists(caseDefinitionsPath))
			Files.createDirectories(caseDefinitionsPath);
	}

	public List<String> getProjects() {
		final List<String> names = new LinkedList<>();
		try {
			for (Path path: Files.newDirectoryStream(caseDefinitionsPath))
				if (Files.isDirectory(path))
					names.add(path.getFileName().toString().replaceFirst(Pattern.quote(JSON_SUFFIX) + "$", ""));
			Collections.sort(names);
			return names;
		} catch (IOException e) {
			e.printStackTrace();
			return null;
		}
	}

	public List<String> getCaseDefinitionsNames(String project) {
		final List<String> names = new LinkedList<>();
		try {
			for (Path path: Files.newDirectoryStream(caseDefinitionsPath.resolve(project)))
				names.add(path.getFileName().toString().replaceFirst(Pattern.quote(JSON_SUFFIX) + "$", ""));
			Collections.sort(names);
			return names;
		} catch (IOException e) {
			e.printStackTrace();
			return null;
		}
	}

	public String getCaseDefinition(String project, String name) {
		Path path = caseDefinitionsPath.resolve(project).resolve(name + JSON_SUFFIX);
		try {
			byte[] bytes = Files.readAllBytes(path);
			return new String(bytes, Charset.forName("UTF-8"));
		} catch (IOException e) {
			logger.error("Cannot read case definition: " + path);
			return null;
		}
	}

	public void setCaseDefinition(String project, String name, String stateJson)  {
		System.out.println("Set " + name + " to " + stateJson);
		Path path = caseDefinitionsPath.resolve(project).resolve(name + JSON_SUFFIX);
		if (Files.exists(path))
			try {
				Files.delete(path);
			} catch (IOException e) {
				logger.error("Couldn't delete file " + path, e);
				e.printStackTrace();
			}
		try {
			Json.createReader(new StringReader(stateJson)).readObject();
			Files.write(path, stateJson.getBytes(Charset.forName("UTF-8")), StandardOpenOption.CREATE);
		} catch (JsonException e) {
			logger.error("Cannot parse json: " + stateJson);
		} catch (IOException e) {
			logger.error("Cannot store case definition: " + path);
			e.printStackTrace();
		}
	}
}
