const SHEET_NAME = "Horo Leads";
const SESSIONS_SHEET_NAME = "Horo Sessions";
const METRICS_SHEET_NAME = "Horo Metrics";

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

const SESSION_HEADERS = [
  "session_id",
  "first_seen_at",
  "last_seen_at",
  "app_name",
  "source",
  "landing_page_url",
  "referrer",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "user_agent",
  "device_type",
  "viewport_width",
  "viewport_height",
  "page_view_count",
  "primary_cta_clicked_count",
  "link_clicked_count",
  "scroll_depth_count",
  "quiz_started_count",
  "question_viewed_count",
  "question_answered_count",
  "quiz_completed_count",
  "quiz_abandoned_count",
  "result_viewed_count",
  "email_submitted_count",
  "submission_success_count",
  "submission_error_count",
  "share_clicked_count",
  "result_copied_count",
  "max_question_index",
  "question_count",
  "latest_question_key",
  "result_type",
  "lead_score",
  "lead_quality",
  "email_present",
  "instagram_present",
  "pet_type",
  "interest_level",
  "willingness_to_pay",
  "last_event_name",
  "last_event_category",
  "last_event_step",
  "last_event_value",
  "event_names_json",
  "last_event_payload_json",
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

    if (payload.record_type === "event" || payload.event_name) {
      const session = upsertSessionEvent(payload);
      return jsonResponse({
        success: true,
        event_id: payload.event_id || "",
        session_id: session.session_id || "",
      });
    }

    const sheet = getLeadSheet();
    ensureHeaders(sheet, HEADERS);
    sheet.appendRow(buildRow(HEADERS, payload));

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
  const leadSheet = getLeadSheet();
  ensureHeaders(leadSheet, HEADERS);
  leadSheet.setFrozenRows(1);
  leadSheet.autoResizeColumns(1, HEADERS.length);

  const sessionSheet = getSheet(SESSIONS_SHEET_NAME);
  ensureHeaders(sessionSheet, SESSION_HEADERS);
  sessionSheet.setFrozenRows(1);
  sessionSheet.autoResizeColumns(1, SESSION_HEADERS.length);

  setupMetricsSheet();
}

function getLeadSheet() {
  return getSheet(SHEET_NAME);
}

function getSheet(sheetName) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }
  return sheet;
}

function ensureHeaders(sheet, headers) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    return;
  }

  const currentHeaders = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), headers.length)).getValues()[0];
  const hasAllHeaders = headers.every(function (header, index) {
    return currentHeaders[index] === header;
  });

  if (!hasAllHeaders) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
}

function buildRow(headers, payload) {
  return headers.map(function (header) {
    const value = payload[header];
    if (Array.isArray(value)) return value.join(", ");
    if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
    return value === undefined || value === null ? "" : value;
  });
}

function upsertSessionEvent(payload) {
  const sheet = getSheet(SESSIONS_SHEET_NAME);
  ensureHeaders(sheet, SESSION_HEADERS);
  const rowIndex = findSessionRow(sheet, payload.session_id);
  const existing = rowIndex ? rowToObject(SESSION_HEADERS, sheet.getRange(rowIndex, 1, 1, SESSION_HEADERS.length).getValues()[0]) : {};
  const session = mergeSessionEvent(existing, payload);
  const row = buildRow(SESSION_HEADERS, session);

  if (rowIndex) {
    sheet.getRange(rowIndex, 1, 1, SESSION_HEADERS.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }

  return session;
}

function findSessionRow(sheet, sessionId) {
  if (!sessionId || sheet.getLastRow() < 2) return 0;
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  for (let index = 0; index < values.length; index += 1) {
    if (values[index][0] === sessionId) {
      return index + 2;
    }
  }
  return 0;
}

function rowToObject(headers, row) {
  return headers.reduce(function (object, header, index) {
    object[header] = row[index];
    return object;
  }, {});
}

function mergeSessionEvent(existing, payload) {
  const now = payload.created_at || new Date().toISOString();
  const eventName = payload.event_name || "";
  const countColumn = eventName ? eventName + "_count" : "";
  const eventNames = safeParseJson(existing.event_names_json, []);
  if (eventName) eventNames.push(eventName);

  const session = Object.assign({}, existing, {
    session_id: payload.session_id || existing.session_id || "",
    first_seen_at: existing.first_seen_at || now,
    last_seen_at: now,
    app_name: payload.app_name || existing.app_name || "Horo",
    source: payload.source || existing.source || "GitHub Pages landing page",
    landing_page_url: payload.landing_page_url || existing.landing_page_url || "",
    referrer: payload.referrer || existing.referrer || "",
    utm_source: payload.utm_source || existing.utm_source || "",
    utm_medium: payload.utm_medium || existing.utm_medium || "",
    utm_campaign: payload.utm_campaign || existing.utm_campaign || "",
    utm_content: payload.utm_content || existing.utm_content || "",
    utm_term: payload.utm_term || existing.utm_term || "",
    user_agent: payload.user_agent || existing.user_agent || "",
    device_type: payload.device_type || existing.device_type || "",
    viewport_width: payload.viewport_width || existing.viewport_width || "",
    viewport_height: payload.viewport_height || existing.viewport_height || "",
    max_question_index: Math.max(Number(existing.max_question_index) || 0, Number(payload.question_index) || 0),
    question_count: payload.question_count || existing.question_count || "",
    latest_question_key: payload.question_key || existing.latest_question_key || "",
    result_type: payload.result_type || existing.result_type || "",
    lead_score: payload.lead_score || existing.lead_score || 0,
    lead_quality: payload.lead_quality || existing.lead_quality || "",
    email_present: Boolean(payload.email_present) || existing.email_present === "TRUE" || existing.email_present === true,
    instagram_present: Boolean(payload.instagram_present) || existing.instagram_present === "TRUE" || existing.instagram_present === true,
    pet_type: payload.pet_type || existing.pet_type || "",
    interest_level: payload.interest_level || existing.interest_level || "",
    willingness_to_pay: payload.willingness_to_pay || existing.willingness_to_pay || "",
    last_event_name: eventName || existing.last_event_name || "",
    last_event_category: payload.event_category || existing.last_event_category || "",
    last_event_step: payload.event_step || existing.last_event_step || "",
    last_event_value: payload.event_value || existing.last_event_value || "",
    event_names_json: JSON.stringify(eventNames.slice(-100)),
    last_event_payload_json: payload.event_payload_json || existing.last_event_payload_json || "",
  });

  SESSION_HEADERS.forEach(function (header) {
    if (header.endsWith("_count")) {
      session[header] = Number(existing[header]) || 0;
    }
  });

  if (countColumn && SESSION_HEADERS.indexOf(countColumn) !== -1) {
    session[countColumn] = (Number(session[countColumn]) || 0) + 1;
  }

  return session;
}

function safeParseJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    return fallback;
  }
}

function setupMetricsSheet() {
  const sheet = getSheet(METRICS_SHEET_NAME);
  sheet.clear();
  const rows = [
    ["Metric", "Formula", "Why it matters"],
    ["Landing visits", "=SUM('Horo Sessions'!Q:Q)", "How many people landed on the page."],
    ["Primary CTA clicks", "=SUM('Horo Sessions'!R:R)", "How many visitors showed intent to start the quiz from the hero."],
    ["Quiz starts", "=SUM('Horo Sessions'!U:U)", "How many visitors began the survey."],
    ["Quiz completions", "=SUM('Horo Sessions'!X:X)", "How many visitors finished the quiz questions."],
    ["Result views", "=SUM('Horo Sessions'!Z:Z)", "How many visitors saw a partial result."],
    ["Email submit attempts", "=SUM('Horo Sessions'!AA:AA)", "How many visitors tried to join the waitlist."],
    ["Waitlist submissions", "=SUM('Horo Sessions'!AB:AB)", "How many visitors successfully joined the waitlist."],
    ["Quiz start rate", "=IFERROR(B4/B2,0)", "Quiz starts divided by landing visits."],
    ["Quiz completion rate", "=IFERROR(B5/B4,0)", "Quiz completions divided by quiz starts."],
    ["Result-to-email attempt rate", "=IFERROR(B7/B6,0)", "Submit attempts divided by result views."],
    ["Visit-to-waitlist conversion", "=IFERROR(B8/B2,0)", "Successful waitlist joins divided by landing visits."],
    ["Quiz-to-waitlist conversion", "=IFERROR(B8/B4,0)", "Successful waitlist joins divided by quiz starts."],
    ["Share clicks", "=SUM('Horo Sessions'!AD:AD)", "How many users tried to share their result."],
    ["Copied results", "=SUM('Horo Sessions'!AE:AE)", "How many users copied their result."],
    ["Average lead score", "=IFERROR(AVERAGE('Horo Leads'!S:S),0)", "Average validation quality across submitted leads."],
    ["Hot leads", "=COUNTIF('Horo Leads'!T:T,\"Hot\")", "Highest-intent leads."],
    ["Warm leads", "=COUNTIF('Horo Leads'!T:T,\"Warm\")", "Medium-high intent leads."],
    ["Curious leads", "=COUNTIF('Horo Leads'!T:T,\"Curious\")", "Low-medium intent leads."],
    ["Weak leads", "=COUNTIF('Horo Leads'!T:T,\"Weak\")", "Low-intent leads."],
  ];
  sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, rows[0].length);
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
