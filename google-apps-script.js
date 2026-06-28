const SHEET_NAME = "Horo Leads";

const HEADERS = [
  "submission_id",
  "created_at",
  "app_name",
  "source",
  "email",
  "instagram_handle",
  "marketing_consent",
  "pet_type",
  "pet_name",
  "pet_birthday_status",
  "pet_birth_date",
  "pet_energy",
  "pet_personality",
  "astrology_interest",
  "desired_features",
  "interest_level",
  "willingness_to_pay",
  "result_type",
  "lead_score",
  "lead_quality",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "referrer",
  "landing_page_url",
  "user_agent",
  "raw_answers_json",
];

/**
 * Deployment:
 * 1. Create a Google Sheet.
 * 2. Open Extensions > Apps Script.
 * 3. Paste this file into the Apps Script editor.
 * 4. Run setupSheet once and approve permissions.
 * 5. Deploy > New deployment > Web app.
 * 6. Execute as: Me. Who has access: Anyone.
 * 7. Copy the Web App URL into GOOGLE_APPS_SCRIPT_WEB_APP_URL in app.js.
 */
function doPost(e) {
  try {
    const payload = parseRequestBody(e);
    const sheet = getLeadSheet();
    ensureHeaders(sheet);

    const row = HEADERS.map(function (header) {
      const value = payload[header];
      if (Array.isArray(value)) return value.join(", ");
      if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
      return value === undefined || value === null ? "" : value;
    });

    sheet.appendRow(row);

    return jsonResponse({
      success: true,
      submission_id: payload.submission_id || "",
    });
  } catch (error) {
    console.error(error);
    return jsonResponse({
      success: false,
      error: "Unable to save submission.",
    });
  }
}

function doGet() {
  return jsonResponse({
    success: true,
    message: "Horo Leads endpoint is running.",
  });
}

function setupSheet() {
  const sheet = getLeadSheet();
  ensureHeaders(sheet);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, HEADERS.length);
}

function getLeadSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }
  return sheet;
}

function ensureHeaders(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    return;
  }

  const currentHeaders = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), HEADERS.length)).getValues()[0];
  const hasAllHeaders = HEADERS.every(function (header, index) {
    return currentHeaders[index] === header;
  });

  if (!hasAllHeaders) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  }
}

function parseRequestBody(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error("Missing request body.");
  }
  return JSON.parse(e.postData.contents);
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
