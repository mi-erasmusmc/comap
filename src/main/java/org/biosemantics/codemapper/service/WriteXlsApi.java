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
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Arrays;
import java.util.Collection;
import java.util.Comparator;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Set;

import javax.ws.rs.WebApplicationException;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.apache.poi.common.usermodel.HyperlinkType;
import org.apache.poi.hssf.usermodel.HSSFCell;
import org.apache.poi.hssf.usermodel.HSSFCellStyle;
import org.apache.poi.hssf.usermodel.HSSFFont;
import org.apache.poi.hssf.usermodel.HSSFRow;
import org.apache.poi.hssf.usermodel.HSSFSheet;
import org.apache.poi.hssf.usermodel.HSSFWorkbook;
import org.apache.poi.ss.usermodel.Hyperlink;
import org.apache.poi.ss.util.CellRangeAddress;
import org.biosemantics.codemapper.ClientState;
import org.biosemantics.codemapper.ClientState.Concept;
import org.biosemantics.codemapper.Comment;
import org.biosemantics.codemapper.SourceConcept;

/** Export a case definition to an Excel spreadsheet. */
public class WriteXlsApi implements WriteApis.Api {

	static final String FILE_EXTENSION = "xls";
    static final String MIME_TYPE = "application/vnd.ms-excel";
    static final String NO_CODE = "-";
	static Logger logger = LogManager.getLogger(WriteXlsApi.class);

    @Override
    public String getFileExtension() {
        return FILE_EXTENSION;
    }

    @Override
    public String getMimetype() {
        return MIME_TYPE;
    }

    @Override
	public void write(OutputStream output, ClientState.State state, Map<String, Map<String, Collection<SourceConcept>>> descendants, List<Comment> comments, String name, String url) {
		try (HSSFWorkbook workbook = new HSSFWorkbook()) {
			write(workbook, state, descendants, comments, name, url);
			workbook.write(output);
		} catch (IOException e) {
			logger.error("Cannot create workbook", e);
		}
	}

	public void write(HSSFWorkbook workbook, ClientState.State state, Map<String, Map<String, Collection<SourceConcept>>> descendants, List<Comment> comments, String name, String url) 
			throws IOException, WebApplicationException {
		setInfoSheet(workbook.createSheet("Info"), name, url);
		setCodesSheet(workbook.createSheet("Codes"), state.codingSystems, state.mapping.concepts, descendants);
		setHistorySheet(workbook.createSheet("History"), state.mapping.history);
		setCommentsSheet(workbook.createSheet("Comments"), state.mapping.concepts, comments);
		setCaseDefinitionSheet(workbook.createSheet("Case definition"), state.indexing.caseDefinition);
	}



	public void bold(List<HSSFCell> row, HSSFSheet sheet) {
		HSSFCellStyle style = sheet.getWorkbook().createCellStyle();
		HSSFFont font = sheet.getWorkbook().createFont();
		font.setBold(true);
		style.setFont(font);
		for (HSSFCell cell : row)
			cell.setCellStyle(style);
	}

	private void setCommentsSheet(HSSFSheet sheet, Concept[] concepts, List<Comment> comments) {

		DateFormat dateFormat = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX");

		int rowIx = 0;

		List<HSSFCell> header = setTextRow(sheet.createRow(rowIx++), "Date", "User", "Concept", "CUI", "Message");
		bold(header, sheet);

		Map<String, String> conceptNames = new HashMap<>();
		for (ClientState.Concept concept : concepts) {
			conceptNames.put(concept.cui, concept.preferredName);
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
				List<HSSFCell> row = setTextRow(sheet.createRow(rowIx++), dateString, comment.getAuthor(), concept,
						comment.getCui(), comment.getContent());
				if (date != null) {
					HSSFCellStyle style = sheet.getWorkbook().createCellStyle();
					short format = sheet.getWorkbook().getCreationHelper().createDataFormat().getFormat("m/d/yy hh:mm");
					style.setDataFormat(format);
					row.get(0).setCellValue(date);
					row.get(0).setCellStyle(style);
				}
			}
		}

		sheet.setAutoFilter(new CellRangeAddress(0, rowIx - 1, 0, header.size() - 1));
	}

	private void setHistorySheet(HSSFSheet sheet, ClientState.HistoryEntry<?, ?>[] history) {
		int rowIx = 0;

		DateFormat dateFormat = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");

		List<HSSFCell> header = setTextRow(sheet.createRow(rowIx++), "Date", "User", "Operation", "Argument", "Result");
		bold(header, sheet);

		for (ClientState.HistoryEntry<?, ?> entry : history) {
			Date date = null;
			try {
				date = dateFormat.parse(entry.date);
			} catch (ParseException e) {
				logger.error("Couldn't parse date", e);
			}
			String operation = entry.getClass().getName().substring("HistoryEntry".length());
			String argument = historyDatumToString(entry.argument);
			String result = historyDatumToString(entry.result);
			List<HSSFCell> row = setTextRow(sheet.createRow(rowIx++), entry.date, entry.user, operation, argument, result);			
			if (date != null) {
				HSSFCellStyle style = sheet.getWorkbook().createCellStyle();
				short format = sheet.getWorkbook().getCreationHelper().createDataFormat().getFormat("m/d/yy hh:mm");
				style.setDataFormat(format);
				row.get(0).setCellStyle(style);
				row.get(0).setCellValue(date);
			}
		}
		sheet.setAutoFilter(new CellRangeAddress(0, rowIx - 1, 0, header.size() - 1));
	}

	private static String historyDatumToString(Object data) {
		if (data == null) {
			return "";
		}
		if (data instanceof ClientState.ShortConcept) {
			ClientState.ShortConcept concept = (ClientState.ShortConcept) data;
			return concept.preferredName;
		}
		if (data instanceof String) {
			return (String) data;
		}
		if (data instanceof ClientState.ShortConcept[]) {
			ClientState.ShortConcept[] concepts = (ClientState.ShortConcept[]) data;
			StringBuffer sb = new StringBuffer();
			for (int i = 0; i < concepts.length; i++) {
				if (i != 0) {
					sb.append(", ");
				}
				sb.append(concepts[i].preferredName != null ? concepts[i].preferredName : concepts[i].cui);
			}
			return sb.toString();
		}
		logger.error(String.format("Cannot convert history datum %s of class %s", data, data.getClass()));
		return null;
	}

	private List<HSSFCell> setTextRow(HSSFRow row, String... cells) {
		HSSFWorkbook wb = row.getSheet().getWorkbook();
		short textFormat = wb.getCreationHelper().createDataFormat().getFormat("@");
		HSSFCellStyle textStyle = wb.createCellStyle();
		textStyle.setDataFormat(textFormat);
		List<HSSFCell> result = new LinkedList<>();
		for (int ix = 0; ix < cells.length; ix++) {
			HSSFCell cell = row.createCell(ix);
			cell.setCellValue(cells[ix]);
			cell.setCellStyle(textStyle);
			result.add(cell);
		}
		return result;
	}

	private void setInfoSheet(HSSFSheet sheet, String name, String url) {
		int rowIx = 0;

		setTextRow(sheet.createRow(rowIx++), "Case definition:", name);
                if (url != null) {
                    Hyperlink hyperlink = sheet.getWorkbook().getCreationHelper().createHyperlink(HyperlinkType.URL);
                    hyperlink.setAddress(url);
                    setTextRow(sheet.createRow(rowIx++), "URL:", url).get(1).setHyperlink(hyperlink);
                }
		rowIx++;
		setTextRow(sheet.createRow(rowIx++), "Case definition created with ADVANCE Code Mapper");
		OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
		setTextRow(sheet.createRow(rowIx++), "Downloaded at UTC " + now);
		setTextRow(sheet.createRow(rowIx++),
				"Concepts, history, comments and original wording of the case definitions are in separate sheets.");

	}

	private void setCaseDefinitionSheet(HSSFSheet sheet, String caseDefinition) {
		sheet.setColumnWidth(0, 255 * 256);
		int rowIx = 0;
		for (String line : caseDefinition.split("\\r?\\n")) {
			if (line.length() > 32767) {
				line = line.substring(0, 32766) + "…";
			}
			List<HSSFCell> row = setTextRow(sheet.createRow(rowIx++), line);
			HSSFCellStyle style = sheet.getWorkbook().createCellStyle();
			style.setWrapText(true);
			row.get(0).setCellStyle(style);
		}
	}

	private void setCodesSheet(HSSFSheet sheet, String[] codingSystems, ClientState.Concept[] concepts, Map<String, Map<String, Collection<SourceConcept>>> descendants) {
		int rowIx = 0;

		List<HSSFCell> header = setTextRow(sheet.createRow(rowIx++), WriteApis.CODES_HEADERS);
		bold(header, sheet);

		for (String codingSystem : codingSystems) {
        	// {tags -> {code}}
            Map<String, Set<String>> allPrintedCodes = new HashMap<>();
			for (ClientState.Concept concept : concepts) {
                String tags = WriteApis.formatTags(concept.tags);
                if (!allPrintedCodes.containsKey(tags)) {
                	allPrintedCodes.put(tags, new HashSet<>());
                }
                Set<String> printedCodes = allPrintedCodes.get(tags);
				String cui = concept.cui;
				String conceptName = concept.preferredName;
				boolean printedCode = false;
				org.biosemantics.codemapper.ClientState.SourceConcept[] sourceConcepts = concept.codes.get(codingSystem).clone();
				Arrays.sort(sourceConcepts, Comparator.comparing(c -> c.id));
				for (ClientState.SourceConcept sourceConcept : sourceConcepts) {
					if (!sourceConcept.selected) continue;
					if (!printedCodes.contains(sourceConcept.id)) {
						setTextRow(sheet.createRow(rowIx++),
								codingSystem, sourceConcept.id, sourceConcept.preferredTerm,
								concept.cui, concept.preferredName, tags, WriteApis.origin(concept.origin));
						printedCodes.add(sourceConcept.id);
						printedCode = true;
					}
					if (descendants.get(codingSystem) != null && descendants.get(codingSystem).get(sourceConcept.id) != null) {
						SourceConcept[] descConcepts = descendants.get(codingSystem).get(sourceConcept.id).toArray(new SourceConcept[0]);
						Arrays.sort(descConcepts);
						for (SourceConcept c : descConcepts) {
							if (!printedCodes.contains(c.getId())) {
								setTextRow(sheet.createRow(rowIx++), 
										codingSystem, c.getId(), c.getPreferredTerm(), null, null,
										tags, desc(sourceConcept.id));
								printedCodes.add(c.getId());
								printedCode = true;
							}
						}
					}
				}
				if (!printedCode) {
					setTextRow(sheet.createRow(rowIx++),
							codingSystem, NO_CODE, null, cui, conceptName, tags);
				}
			}
		}
		sheet.setAutoFilter(new CellRangeAddress(0, rowIx - 1, 0, header.size() - 1));
	}

	public static String desc(String id) {
        return "DESC (" + id + ")";
    }
}
