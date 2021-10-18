/*******************************************************************************
 * Copyright 2017 Erasmus Medical Center, Department of Medical Informatics.
 * 
 * This program shall be referenced as “Codemapper”.
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 * 
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 ******************************************************************************/
package org.biosemantics.codemapper.service;

import java.io.IOException;
import java.io.OutputStream;
import java.text.DateFormat;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;

import javax.ws.rs.WebApplicationException;

import org.apache.poi.ss.usermodel.Hyperlink;
import org.apache.poi.common.usermodel.HyperlinkType;
import org.apache.poi.ss.util.CellRangeAddress;
import org.biosemantics.codemapper.CodeMapperException;
import org.biosemantics.codemapper.Comment;
import org.biosemantics.codemapper.rest.CodeMapperApplication;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.apache.poi.hssf.usermodel.HSSFCell;
import org.apache.poi.hssf.usermodel.HSSFCellStyle;
import org.apache.poi.hssf.usermodel.HSSFFont;
import org.apache.poi.hssf.usermodel.HSSFRow;
import org.apache.poi.hssf.usermodel.HSSFSheet;
import org.apache.poi.hssf.usermodel.HSSFWorkbook;
import org.json.JSONArray;
import org.json.JSONObject;

/** Export a casedefinition to an Excel spreadsheet. */
public class WriteXlsApi {

	private static final String NO_CODE = "-";
	private static Logger logger = LogManager.getLogger(WriteXlsApi.class);

	public JSONObject writeXls(String project, String caseDefinition) throws CodeMapperException {

		String jsonState = CodeMapperApplication.getPersistencyApi().getCaseDefinition(project, caseDefinition);
		if (jsonState == null)
			return null;
		JSONObject state = new JSONObject(jsonState);
		return state;
	}

	public void writeXls(JSONObject state, List<Comment> comments, String name, String url, OutputStream output) {
		try (HSSFWorkbook workbook = new HSSFWorkbook()) {
			writeXls(workbook, state, comments, name, url);
			workbook.write(output);
		} catch (IOException e) {
			logger.error("Cannot create workbook", e);
		}
	}

	public void writeXls(HSSFWorkbook workbook, JSONObject state, List<Comment> comments, String name, String url) 
			throws IOException, WebApplicationException {
		setInfoSheet(workbook.createSheet("Info"), state, name, url);
		setCodesSheet(workbook.createSheet("Codes"), state);
		setHistorySheet(workbook.createSheet("History"), state);
		setCommentsSheet(workbook.createSheet("Comments"), state, comments);
		setCaseDefinitionSheet(workbook.createSheet("Case definition"), state);
	}

	public void bold(List<HSSFCell> row, HSSFSheet sheet) {
		HSSFCellStyle style = sheet.getWorkbook().createCellStyle();
		HSSFFont font = sheet.getWorkbook().createFont();
		font.setBold(true);
		style.setFont(font);
		for (HSSFCell cell : row)
			cell.setCellStyle(style);
	}

	private void setCommentsSheet(HSSFSheet sheet, JSONObject state, List<Comment> comments) {

		DateFormat dateFormat = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX");

		int rowIx = 0;

		List<HSSFCell> header = setRow(sheet.createRow(rowIx++), "Date", "User", "Concept", "CUI", "Message");
		bold(header, sheet);

		Map<String, String> conceptNames = new HashMap<>();
		JSONArray concepts = state.getJSONObject("mapping").getJSONArray("concepts");
		for (int conceptIx = 0; conceptIx < concepts.length(); conceptIx++) {
			JSONObject concept = concepts.getJSONObject(conceptIx);
			conceptNames.put(concept.getString("cui"), concept.getString("preferredName"));
		}

		for (Comment comment : comments) {
			String dateString = comment.getTimestamp();
			Date date = null;
			try {
				date = dateFormat.parse(dateString);
			} catch (ParseException e) {
				logger.error("Couldn't parse date", e);
			}
			String concept = conceptNames.get(comment.getCui());
			if (concept != null) {
				List<HSSFCell> row = setRow(sheet.createRow(rowIx++), dateString, comment.getAuthor(), concept,
						comment.getCui(), comment.getContent());
				if (date != null) {
					row.get(0).setCellValue(date);
					HSSFCellStyle style = sheet.getWorkbook().createCellStyle();
					short format = sheet.getWorkbook().getCreationHelper().createDataFormat().getFormat("m/d/yy hh:mm");
					style.setDataFormat(format);
					row.get(0).setCellStyle(style);
				}
			}
		}

		sheet.setAutoFilter(new CellRangeAddress(0, rowIx - 1, 0, header.size() - 1));
	}

	private void setHistorySheet(HSSFSheet sheet, JSONObject state) {
		int rowIx = 0;

		DateFormat dateFormat = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");

		List<HSSFCell> header = setRow(sheet.createRow(rowIx++), "Date", "User", "Operation", "Argument", "Result");
		bold(header, sheet);

		JSONArray steps = state.getJSONObject("mapping").optJSONArray("history");
		for (int stepIx = 0; stepIx < steps.length(); stepIx++) {
			JSONObject step = steps.getJSONObject(stepIx);
			String dateString = step.getString("date");
			Date date = null;
			try {
				date = dateFormat.parse(dateString);
			} catch (ParseException e) {
				logger.error("Couldn't parse date", e);
			}
			String user = step.getString("user");
			String operation = step.getString("operation");
			String argument = historyDatumToString(step.get("argument"));
			String result = historyDatumToString(step.get("result"));
			List<HSSFCell> row = setRow(sheet.createRow(rowIx++), dateString, user, operation, argument, result);
			if (date != null) {
				row.get(0).setCellValue(date);
				HSSFCellStyle style = sheet.getWorkbook().createCellStyle();
				short format = sheet.getWorkbook().getCreationHelper().createDataFormat().getFormat("m/d/yy hh:mm");
				style.setDataFormat(format);
				row.get(0).setCellStyle(style);
			}
		}
		sheet.setAutoFilter(new CellRangeAddress(0, rowIx - 1, 0, header.size() - 1));
	}

	private static String historyDatumToString(Object data) {
		if (data.equals(JSONObject.NULL))
			return "";
		if (data instanceof JSONObject) {
			JSONObject concept = (JSONObject) data;
			return concept.getString("preferredName");
		}
		if (data instanceof String)
			return (String) data;
		if (data instanceof JSONArray) {
			StringBuffer sb = new StringBuffer();
			JSONArray array = (JSONArray) data;
			for (int ix = 0; ix < array.length(); ix++) {
				JSONObject concept = array.getJSONObject(ix);
				if (ix != 0)
					sb.append(", ");
				sb.append(concept.isNull("preferredName") ? "?" : concept.getString("preferredName"));
			}
			return sb.toString();
		}
		logger.error(String.format("Cannot convert history datum %s of class %s", data, data.getClass()));
		return null;
	}

	private List<HSSFCell> setRow(HSSFRow row, String... cells) {
		List<HSSFCell> result = new LinkedList<>();
		for (int ix = 0; ix < cells.length; ix++) {
			HSSFCell cell = row.createCell(ix);
			cell.setCellValue(cells[ix]);
			result.add(cell);
		}
		return result;
	}

	private void setInfoSheet(HSSFSheet sheet, JSONObject state, String name, String url) {
		int rowIx = 0;

		Hyperlink hyperlink = sheet.getWorkbook().getCreationHelper().createHyperlink(HyperlinkType.URL);
		hyperlink.setAddress(url);

		setRow(sheet.createRow(rowIx++), "Case definition:", name);
		setRow(sheet.createRow(rowIx++), "URL:", url).get(1).setHyperlink(hyperlink);
		rowIx++;
		setRow(sheet.createRow(rowIx++), "Case definition created with ADVANCE Code Mapper");
		setRow(sheet.createRow(rowIx++),
				"Concepts, history, comments and original wording of the case definitions are in separate sheets.");

	}

	private void setCaseDefinitionSheet(HSSFSheet sheet, JSONObject state) {
		int rowIx = 0;
		String text = state.getJSONObject("indexing").getString("caseDefinition");
		HSSFCellStyle style = sheet.getWorkbook().createCellStyle();
//		style.setWrapText(true);
		HSSFRow row = sheet.createRow(rowIx++);
		setRow(row, text).get(0).setCellStyle(style);
		row.setHeight((short) -1);
	}

	private void setCodesSheet(HSSFSheet sheet, JSONObject state) {
		int rowIx = 0;

		List<HSSFCell> header = setRow(sheet.createRow(rowIx++), "Coding system", "Code", "Code name", "Concept",
				"Concept name", "Tags");// , "Origin", "Root concept");
		bold(header, sheet);

		JSONArray codingSystems = state.getJSONArray("codingSystems");
		for (int codingSystemIx = 0; codingSystemIx < codingSystems.length(); codingSystemIx++) {
			String codingSystem = codingSystems.getString(codingSystemIx);

			JSONArray concepts = state.getJSONObject("mapping").getJSONArray("concepts");
			for (int conceptIx = 0; conceptIx < concepts.length(); conceptIx++) {
				JSONObject concept = concepts.getJSONObject(conceptIx);
				String tags = formatTags(concept.optJSONArray("tags"));
				JSONArray codes = concept.getJSONObject("codes").getJSONArray(codingSystem);
				String cui = concept.getString("cui");
				String conceptName = concept.getString("preferredName");
				if (codes.length() == 0)
					setRow(sheet.createRow(rowIx++), codingSystem, NO_CODE, null, cui, conceptName, tags);
				else
					for (int codeIx = 0; codeIx < codes.length(); codeIx++) {
						JSONObject code = codes.getJSONObject(codeIx);
						String codeId = code.getString("id");
						String codeName = code.getString("preferredTerm");
						setRow(sheet.createRow(rowIx++), codingSystem, codeId, codeName, cui, conceptName, tags);
					}
			}
		}
		sheet.setAutoFilter(new CellRangeAddress(0, rowIx - 1, 0, header.size() - 1));
	}

	private String formatTags(JSONArray tagsArray) {
		if (tagsArray == null)
			return null;
		StringBuilder sb = new StringBuilder();
		for (int tagIx = 0; tagIx < tagsArray.length(); tagIx++) {
			if (sb.length() > 0)
				sb.append(", ");
			sb.append(tagsArray.get(tagIx));
		}
		return sb.toString();
	}
}
