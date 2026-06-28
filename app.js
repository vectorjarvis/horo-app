const GOOGLE_APPS_SCRIPT_WEB_APP_URL = "https://script.google.com/macros/s/AKfycby4r9qc3uptZ4rB8IJqsjTIiz14QalZml2f01-QurBbbXU7Ly8Dr7hubHynT_HUogfM/exec";
const ENABLE_FUNNEL_ANALYTICS = true; // Set to true only after redeploying google-apps-script.js with Horo Sessions support.

const STORAGE_KEYS = {
  pending: "horo_pending_submissions",
  successful: "horo_successful_submission_ids",
  pendingEvents: "horo_pending_events",
  sessionId: "horo_session_id",
};

const DATE_REQUIRED_BIRTHDAY_STATUSES = ["Yes, I know the exact date", "I know the adoption/gotcha day"];

const quizQuestions = [
  {
    key: "pet_type",
    type: "single",
    question: "Who are we reading today?",
    options: ["Dog", "Cat", "Both, because my house has multiple bosses", "Other tiny creature with a dramatic aura"],
  },
  {
    key: "pet_name",
    type: "text",
    question: "What’s your pet’s name?",
    placeholder: "Luna, Milo, Bella, Mr. Pickles...",
  },
  {
    key: "pet_birthday_status",
    type: "single",
    question: "Do you know your pet’s birthday?",
    options: [
      "Yes, I know the exact date",
      "I know the adoption/gotcha day",
      "I only know the month",
      "No, but their personality is loud enough",
    ],
  },
  {
    key: "pet_birth_date",
    type: "date",
    question: "What date should we use for their cosmic file?",
    dependsOn: ["Yes, I know the exact date", "I know the adoption/gotcha day"],
  },
  {
    key: "pet_energy",
    type: "single",
    question: "What has your pet’s energy been like recently?",
    options: [
      "Chaotic but adorable",
      "Clingy and emotional",
      "Judging everyone silently",
      "Zoomies at spiritually concerning hours",
      "Sleepy little potato",
      "Suspiciously well-behaved",
    ],
  },
  {
    key: "pet_personality",
    type: "single",
    question: "Pick the phrase that best describes your pet.",
    options: [
      "Main character energy",
      "Soft baby angel",
      "Tiny dictator",
      "Snack-driven philosopher",
      "Mysterious little roommate",
      "Emotional support gremlin",
      "Drama queen / drama king",
      "Independent icon",
    ],
  },
  {
    key: "astrology_interest",
    type: "single",
    question: "How into astrology are you?",
    options: [
      "I check my horoscope daily",
      "I know my sun, moon, and rising",
      "I like it casually",
      "I mostly think it is fun",
      "I am skeptical, but this is cute",
    ],
  },
  {
    key: "desired_features",
    type: "multi",
    question: "What would you want Horo to give you?",
    subtitle: "Pick anything that sounds useful or delightfully unnecessary.",
    options: [
      "Daily pet horoscope",
      "Pet personality reading",
      "Compatibility between me and my pet",
      "Funny shareable readings",
      "Moon phase mood alerts",
      "Birthday/gotcha day readings",
      "Pet-parent insights",
      "Cute widgets for my iPhone",
    ],
  },
  {
    key: "interest_level",
    type: "single",
    question: "If Horo launched as an iOS app, how likely would you be to try it?",
    options: [
      "I would download this immediately",
      "I would probably try it",
      "Maybe, if the readings are cute",
      "I would follow it on Instagram first",
      "Probably not",
    ],
  },
  {
    key: "willingness_to_pay",
    type: "single",
    question: "If the app was genuinely fun and personalized, what would feel reasonable?",
    options: ["Free only", "$1.99/month", "$4.99/month", "$9.99/month", "One-time purchase", "Not sure yet"],
  },
];

const resultTypes = {
  "Chaos Comet": {
    description:
      "Your pet may be powered by moonlight, snacks, and a complete disregard for household peace. Horo was basically made for this level of cosmic nonsense.",
    bullets: ["Peak zoomie potential", "Likely to start drama for enrichment", "Needs a daily cosmic warning label"],
  },
  "Cuddle Moon": {
    description:
      "Your pet’s emotional tide is strong, sweet, and possibly attached to your sleeve. Their love language is proximity with a hint of lunar intensity.",
    bullets: ["Soft-hearted shadow energy", "Premium snuggle forecast", "May sigh dramatically for attention"],
  },
  "Royal Leo Paw": {
    description:
      "Your pet has the presence of someone who believes the entire household is staff. Honestly, the chart supports them.",
    bullets: ["Main character aura", "Strong throne preferences", "Accepts compliments as payment"],
  },
  "Snack Prophet": {
    description:
      "Your pet understands one universal truth: all roads lead to treats. Their spiritual gifts include timing, eye contact, and kitchen surveillance.",
    bullets: ["Snack intuition is advanced", "Will manifest crumbs", "Food bowl readings may be intense"],
  },
  "Mystery Void": {
    description:
      "Your pet contains secrets, side quests, and at least one unreadable facial expression. The universe is intrigued and slightly intimidated.",
    bullets: ["Silent judgment rising", "Excellent moonlit lurking", "Emotionally complex in a chic way"],
  },
  "Sleepy Starbean": {
    description:
      "Your pet’s chart suggests cozy gravity, soft blankets, and a sacred commitment to doing absolutely nothing with style.",
    bullets: ["Nap houses are favored", "Calm little cloud energy", "Dreams may contain snacks"],
  },
};

let currentStep = 0;
let answers = {};
let resultType = "";
let hasStarted = false;
let submissionId = "";
let quizCompleted = false;
let leadSubmitted = false;
let maxScrollDepth = 0;
const sessionId = getOrCreateSessionId();

const stage = document.querySelector("#quiz-stage");
const controls = document.querySelector("#quiz-controls");
const progressWrap = document.querySelector("#quiz-progress");
const progressLabel = document.querySelector("#progress-label");
const progressPercent = document.querySelector("#progress-percent");
const progressBar = document.querySelector("#progress-bar");
const errorBox = document.querySelector("#quiz-error");
const backButton = document.querySelector("#back-button");
const nextButton = document.querySelector("#next-button");

document.addEventListener("DOMContentLoaded", () => {
  trackEvent("page_view", { event_category: "acquisition", event_step: "landing" });
  renderIntro();
  retryPendingSubmissions();
  retryPendingEvents();
  bindGlobalAnalyticsEvents();
  document.querySelectorAll("[data-action='start-quiz']").forEach((link) => {
    link.addEventListener("click", () => {
      if (!hasStarted) {
        startQuiz();
      }
    });
  });
});

backButton.addEventListener("click", () => {
  clearError();
  if (currentStep > 0) {
    currentStep = getPreviousStep(currentStep);
    renderQuestion();
  }
});

nextButton.addEventListener("click", () => {
  clearError();
  const question = getVisibleQuestions()[currentStep];
  if (!validateQuestion(question)) {
    return;
  }

  trackEvent("question_answered", { key: question.key, value: answers[question.key] });

  if (currentStep < getVisibleQuestions().length - 1) {
    currentStep += 1;
    renderQuestion();
    return;
  }

  resultType = calculateResultType();
  trackEvent("quiz_completed", { result_type: resultType });
  quizCompleted = true;
  showResult();
});

window.addEventListener("pagehide", () => {
  if (hasStarted && !leadSubmitted) {
    trackEvent("quiz_abandoned", {
      event_category: "funnel",
      event_step: quizCompleted ? "result_email_capture" : "quiz_questions",
      question_index: Math.min(currentStep + 1, getVisibleQuestions().length),
      question_count: getVisibleQuestions().length,
      result_type: resultType,
    });
  }
});

window.addEventListener("scroll", () => {
  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  if (scrollable <= 0) return;
  const depth = Math.min(100, Math.round((window.scrollY / scrollable) * 100));
  const milestone = [25, 50, 75, 90].find((value) => depth >= value && maxScrollDepth < value);
  if (milestone) {
    maxScrollDepth = milestone;
    trackEvent("scroll_depth", {
      event_category: "engagement",
      event_step: `${milestone}%`,
      event_value: milestone,
    });
  }
}, { passive: true });

function startQuiz() {
  hasStarted = true;
  currentStep = 0;
  answers = {
    desired_features: [],
    marketing_consent: false,
    instagram_handle: "",
    pet_birth_date: "",
  };
  submissionId = createSubmissionId();
  quizCompleted = false;
  leadSubmitted = false;
  trackEvent("quiz_started", { event_category: "funnel", event_step: "quiz_start" });
  renderQuestion();
}

function renderIntro() {
  progressWrap.hidden = true;
  controls.hidden = true;
  stage.innerHTML = `
    <div class="quiz-panel">
      <span class="result-badge">60-second cosmic diagnosis</span>
      <h3>What is your pet’s cosmic personality type?</h3>
      <p class="subtitle">Answer 10 tiny questions. Get your pet’s cosmic type. Join the private iOS beta to unlock the full reading.</p>
      <button class="button button-primary" type="button" id="start-button">Start the Quiz</button>
    </div>
  `;
  document.querySelector("#start-button").addEventListener("click", startQuiz);
}

function renderQuestion() {
  const visibleQuestions = getVisibleQuestions();
  const question = visibleQuestions[currentStep];
  progressWrap.hidden = false;
  controls.hidden = false;
  backButton.disabled = currentStep === 0;
  nextButton.textContent = currentStep === visibleQuestions.length - 1 ? "Reveal Result" : "Next";
  updateProgress(visibleQuestions.length);
  trackEvent("question_viewed", {
    event_category: "funnel",
    event_step: "question",
    question_key: question.key,
    question_index: currentStep + 1,
    question_count: visibleQuestions.length,
  });

  const subtitle = question.subtitle ? `<p class="subtitle">${escapeHtml(question.subtitle)}</p>` : "";
  stage.innerHTML = `
    <div class="quiz-panel">
      <h3>${escapeHtml(question.question)}</h3>
      ${subtitle}
      ${renderInput(question)}
    </div>
  `;
  bindQuestionEvents(question);
}

function renderInput(question) {
  const value = answers[question.key] || "";
  if (question.type === "single") {
    return `
      <div class="option-grid">
        ${question.options
          .map((option) => {
            const selected = value === option ? " is-selected" : "";
            return `<button class="option-button${selected}" type="button" data-value="${escapeAttr(option)}"><span class="option-dot"></span>${escapeHtml(option)}</button>`;
          })
          .join("")}
      </div>
    `;
  }

  if (question.type === "multi") {
    const selectedValues = Array.isArray(value) ? value : [];
    return `
      <div class="option-grid">
        ${question.options
          .map((option) => {
            const selected = selectedValues.includes(option) ? " is-selected" : "";
            return `<button class="checkbox-option${selected}" type="button" data-value="${escapeAttr(option)}"><span class="option-dot"></span>${escapeHtml(option)}</button>`;
          })
          .join("")}
      </div>
    `;
  }

  if (question.type === "email") {
    return `
      <div class="field-stack">
        <label class="input-label">
          Email address
          <input class="text-input" type="email" inputmode="email" autocomplete="email" value="${escapeAttr(answers.email || "")}" placeholder="you@example.com" data-field="email">
        </label>
        <label class="input-label">
          Instagram handle, optional
          <input class="text-input" type="text" autocomplete="off" value="${escapeAttr(answers.instagram_handle || "")}" placeholder="@yourhandle" data-field="instagram_handle">
        </label>
        <label class="consent-row">
          <input type="checkbox" data-field="marketing_consent" ${answers.marketing_consent ? "checked" : ""}>
          <span>I agree to receive updates about Horo’s launch and early access. I understand I can unsubscribe later.</span>
        </label>
      </div>
    `;
  }

  const inputType = question.type === "date" ? "date" : "text";
  const placeholder = question.placeholder ? ` placeholder="${escapeAttr(question.placeholder)}"` : "";
  return `
    <div class="field-stack">
      <label class="input-label">
        ${escapeHtml(question.type === "date" ? "Date" : "Pet name")}
        <input class="text-input" type="${inputType}" value="${escapeAttr(value)}"${placeholder} data-field="${escapeAttr(question.key)}">
      </label>
    </div>
  `;
}

function bindQuestionEvents(question) {
  if (question.type === "single") {
    stage.querySelectorAll("[data-value]").forEach((button) => {
      button.addEventListener("click", () => {
        answers[question.key] = button.dataset.value;
        if (question.key === "pet_birthday_status" && !DATE_REQUIRED_BIRTHDAY_STATUSES.includes(button.dataset.value)) {
          answers.pet_birth_date = "";
        }
        renderQuestion();
      });
    });
    return;
  }

  if (question.type === "multi") {
    stage.querySelectorAll("[data-value]").forEach((button) => {
      button.addEventListener("click", () => {
        const selected = new Set(answers[question.key] || []);
        if (selected.has(button.dataset.value)) {
          selected.delete(button.dataset.value);
        } else {
          selected.add(button.dataset.value);
        }
        answers[question.key] = [...selected];
        renderQuestion();
      });
    });
    return;
  }

  stage.querySelectorAll("[data-field]").forEach((input) => {
    input.addEventListener("input", () => {
      if (input.type === "checkbox") {
        answers[input.dataset.field] = input.checked;
      } else {
        answers[input.dataset.field] = input.value.trim();
      }
    });
  });
}

function validateQuestion(question) {
  if (question.type === "single" && !answers[question.key]) {
    showError("Pick the option that feels most cosmically accurate.");
    return false;
  }

  if (question.type === "multi" && (!answers[question.key] || answers[question.key].length === 0)) {
    showError("Choose at least one thing you’d want from Horo.");
    return false;
  }

  if (question.type === "text" && !answers[question.key]) {
    showError("Add your pet’s name so we can open the correct cosmic file.");
    return false;
  }

  if (question.type === "date" && !answers[question.key]) {
    showError("Add a date, even if it’s their gotcha day.");
    return false;
  }

  if (question.type === "email") {
    if (!isValidEmail(answers.email || "")) {
      showError("Enter a valid email address for the private waitlist.");
      return false;
    }
    if (!answers.marketing_consent) {
      showError("Please agree to receive Horo launch and early access updates.");
      return false;
    }
  }

  return true;
}

function getVisibleQuestions() {
  return quizQuestions.filter((question) => {
    if (question.key !== "pet_birth_date") {
      return true;
    }
    return DATE_REQUIRED_BIRTHDAY_STATUSES.includes(answers.pet_birthday_status);
  });
}

function getPreviousStep(step) {
  return Math.max(0, step - 1);
}

function updateProgress(total) {
  const current = currentStep + 1;
  const percent = Math.round((current / total) * 100);
  progressLabel.textContent = `Question ${current} of ${total}`;
  progressPercent.textContent = `${percent}%`;
  progressBar.style.width = `${percent}%`;
}

function showResult() {
  progressWrap.hidden = true;
  controls.hidden = true;
  clearError();
  const result = resultTypes[resultType];
  const petName = answers.pet_name || "Your pet";
  trackEvent("result_viewed", {
    event_category: "funnel",
    event_step: "result_view",
    result_type: resultType,
  });
  stage.innerHTML = `
    <div class="quiz-panel result-unlock-card">
      <span class="result-badge">Your pet’s result: ${escapeHtml(resultType)}</span>
      <h3>${escapeHtml(petName)} is giving ${escapeHtml(resultType)}.</h3>
      <p class="subtitle">${escapeHtml(result.description)}</p>
      <p class="unlock-heading">The full Horo profile includes:</p>
      <ul class="result-list">
        <li>Your pet’s cosmic personality reading</li>
        <li>Daily horoscope preview</li>
        <li>Pet-parent compatibility</li>
        <li>Moon mood forecast</li>
      </ul>
      <div class="teaser-notes">
        ${result.bullets.map((bullet) => `<span>${escapeHtml(bullet)}</span>`).join("")}
      </div>
      <div class="unlock-form" aria-label="Join the Horo waitlist">
        <p class="privacy-note">Join the private iOS waitlist to unlock the full profile when Horo launches. We’ll only email you about Horo early access and launch updates. No spam. Unsubscribe anytime.</p>
        <label class="input-label">
          Email address
          <input class="text-input" type="email" inputmode="email" autocomplete="email" value="${escapeAttr(answers.email || "")}" placeholder="you@example.com" data-field="email">
        </label>
        <label class="input-label">
          Instagram handle, optional
          <input class="text-input" type="text" autocomplete="off" value="${escapeAttr(answers.instagram_handle || "")}" placeholder="@yourhandle" data-field="instagram_handle">
        </label>
        <label class="consent-row">
          <input type="checkbox" data-field="marketing_consent" ${answers.marketing_consent ? "checked" : ""}>
          <span>I agree to receive updates about Horo’s launch and early access. I understand I can unsubscribe later.</span>
        </label>
        <button class="button button-primary" type="button" id="submit-button">Join the Horo Waitlist</button>
      </div>
    </div>
  `;

  bindEmailCaptureEvents();
  document.querySelector("#submit-button").addEventListener("click", submitLead);
}

async function submitLead() {
  const submitButton = document.querySelector("#submit-button");
  clearError();
  if (!validateEmailCapture()) {
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "Sending to the stars...";
  trackEvent("email_submitted", {
    event_category: "conversion",
    event_step: "waitlist_submit_attempt",
    email_present: Boolean(answers.email),
    instagram_present: Boolean(answers.instagram_handle),
    result_type: resultType,
  });

  const payload = buildPayload();
  try {
    await submitPayload(payload);
    markSubmissionSuccessful(payload.submission_id);
    leadSubmitted = true;
    trackEvent("submission_success", {
      event_category: "conversion",
      event_step: "waitlist_success",
      submission_id: payload.submission_id,
      lead_score: payload.lead_score,
      lead_quality: payload.lead_quality,
      result_type: resultType,
    });
    showSuccess();
  } catch (error) {
    queuePendingSubmission(payload);
    trackEvent("submission_error", {
      event_category: "conversion",
      event_step: "waitlist_error",
      message: error.message,
      submission_id: payload.submission_id,
      result_type: resultType,
    });
    showError("We saved this locally, but the waitlist endpoint is not reachable yet. Add your Google Apps Script URL in app.js and refresh to retry.");
    submitButton.disabled = false;
    submitButton.textContent = "Try Again";
  }
}

function buildPayload() {
  const leadScore = calculateLeadScore();
  const attribution = getAttribution();
  return {
    submission_id: submissionId || createSubmissionId(),
    created_at: new Date().toISOString(),
    app_name: "Horo",
    source: "GitHub Pages landing page",
    email: answers.email || "",
    instagram_handle: answers.instagram_handle || "",
    marketing_consent: Boolean(answers.marketing_consent),
    pet_type: answers.pet_type || "",
    pet_name: answers.pet_name || "",
    pet_birthday_status: answers.pet_birthday_status || "",
    pet_birth_date: answers.pet_birth_date || "",
    pet_energy: answers.pet_energy || "",
    pet_personality: answers.pet_personality || "",
    astrology_interest: answers.astrology_interest || "",
    desired_features: (answers.desired_features || []).join(", "),
    interest_level: answers.interest_level || "",
    willingness_to_pay: answers.willingness_to_pay || "",
    result_type: resultType,
    lead_score: leadScore,
    lead_quality: calculateLeadQuality(leadScore),
    ...attribution,
    raw_answers_json: JSON.stringify(answers),
  };
}

function createSubmissionId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `horo-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function submitPayload(payload) {
  if (!GOOGLE_APPS_SCRIPT_WEB_APP_URL || GOOGLE_APPS_SCRIPT_WEB_APP_URL.includes("PASTE_YOUR")) {
    throw new Error("Google Apps Script URL is not configured.");
  }

  if (getSuccessfulSubmissionIds().includes(payload.submission_id)) {
    return;
  }

  const response = await fetch(GOOGLE_APPS_SCRIPT_WEB_APP_URL, {
    method: "POST",
    mode: "cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Submission failed with status ${response.status}.`);
  }

  const data = await response.json().catch(() => ({ success: true }));
  if (data.success === false) {
    throw new Error(data.error || "Submission failed.");
  }
}

function calculateResultType() {
  const petType = answers.pet_type || "";
  const energy = answers.pet_energy || "";
  const personality = answers.pet_personality || "";

  if (energy.includes("Zoomies") || energy.includes("Chaotic") || personality.includes("Drama")) {
    return "Chaos Comet";
  }
  if (energy.includes("Clingy") || personality.includes("Soft baby") || personality.includes("Emotional support")) {
    return "Cuddle Moon";
  }
  if (personality.includes("Main character") || personality.includes("Tiny dictator")) {
    return "Royal Leo Paw";
  }
  if (personality.includes("Snack-driven")) {
    return "Snack Prophet";
  }
  if (petType.includes("Cat") || energy.includes("Judging") || personality.includes("Mysterious")) {
    return "Mystery Void";
  }
  if (energy.includes("Sleepy") || energy.includes("well-behaved")) {
    return "Sleepy Starbean";
  }
  return "Chaos Comet";
}

function calculateLeadScore() {
  let score = 0;
  if (answers.interest_level === "I would download this immediately") score += 30;
  if (answers.interest_level === "I would probably try it") score += 20;
  if ((answers.desired_features || []).length >= 3) score += 15;
  if (answers.willingness_to_pay && answers.willingness_to_pay !== "Free only") score += 20;
  if (["I check my horoscope daily", "I know my sun, moon, and rising"].includes(answers.astrology_interest)) score += 15;
  if (answers.instagram_handle) score += 10;
  if (answers.marketing_consent) score += 10;
  return Math.min(score, 100);
}

function calculateLeadQuality(score) {
  if (score >= 80) return "Hot";
  if (score >= 50) return "Warm";
  if (score >= 20) return "Curious";
  return "Weak";
}

function showSuccess() {
  const shareText = getResultShareText();
  stage.innerHTML = `
    <div class="quiz-panel">
      <span class="result-badge">Private waitlist confirmed</span>
      <h3>You’re on the Horo waitlist.</h3>
      <p class="subtitle">Your pet’s cosmic file has been marked as extremely suspicious and spiritually important.</p>
      <div class="share-card" aria-label="Shareable result copy">${escapeHtml(shareText)}</div>
      <p class="subtitle">We’ll email you when early access opens.</p>
      <div class="success-actions">
        <button class="button button-primary" type="button" id="copy-result-button">Copy My Result</button>
        <button class="button button-ghost" type="button" id="share-button">Share With Another Pet Parent</button>
        <a class="button button-ghost" href="https://www.instagram.com/" target="_blank" rel="noopener">Follow us on Instagram</a>
      </div>
    </div>
  `;

  document.querySelector("#copy-result-button").addEventListener("click", async () => {
    await copyText(`${shareText} ${window.location.href}`);
    trackEvent("result_copied", {
      event_category: "sharing",
      event_step: "copy_result",
      result_type: resultType,
    });
    document.querySelector("#copy-result-button").textContent = "Copied";
  });

  document.querySelector("#share-button").addEventListener("click", async () => {
    trackEvent("share_clicked", {
      event_category: "sharing",
      event_step: "share_result",
      result_type: resultType,
    });
    const shareData = {
      title: "Horo",
      text: shareText,
      url: window.location.href,
    };
    if (navigator.share) {
      await navigator.share(shareData).catch(() => {});
    } else {
      await copyText(`${shareText} ${window.location.href}`);
      document.querySelector("#share-button").textContent = "Link Copied";
    }
  });
}

function getAttribution() {
  const params = new URLSearchParams(window.location.search);
  return {
    utm_source: params.get("utm_source") || "",
    utm_medium: params.get("utm_medium") || "",
    utm_campaign: params.get("utm_campaign") || "",
    utm_content: params.get("utm_content") || "",
    utm_term: params.get("utm_term") || "",
    referrer: document.referrer || "",
    landing_page_url: window.location.href,
    user_agent: navigator.userAgent,
  };
}

function trackEvent(eventName, payload = {}) {
  console.log("[Horo event]", eventName, payload);
  queueAnalyticsEvent(buildAnalyticsPayload(eventName, payload));
}

function bindGlobalAnalyticsEvents() {
  document.querySelectorAll("a[href]").forEach((link) => {
    link.addEventListener("click", () => {
      const href = link.getAttribute("href") || "";
      const text = link.textContent.trim();
      const category = href.startsWith("#") ? "navigation" : "outbound";
      trackEvent("link_clicked", {
        event_category: category,
        event_step: href,
        event_value: text,
      });
      if (link.dataset.action === "start-quiz") {
        trackEvent("primary_cta_clicked", {
          event_category: "funnel",
          event_step: "hero_cta",
          event_value: text,
        });
      }
    });
  });

  document.querySelectorAll(".legal-links details").forEach((details) => {
    details.addEventListener("toggle", () => {
      if (details.open) {
        trackEvent("legal_section_opened", {
          event_category: "trust",
          event_step: details.id,
          event_value: details.querySelector("summary")?.textContent || details.id,
        });
      }
    });
  });
}

function buildAnalyticsPayload(eventName, payload = {}) {
  const attribution = getAttribution();
  const leadScore = calculateLeadScore();
  const eventPayload = {
    ...payload,
    answers_snapshot: sanitizeAnswersForAnalytics(),
  };
  return {
    record_type: "event",
    event_id: createSubmissionId(),
    session_id: sessionId,
    submission_id: submissionId || "",
    created_at: new Date().toISOString(),
    app_name: "Horo",
    source: "GitHub Pages landing page",
    event_name: eventName,
    event_category: payload.event_category || "",
    event_step: payload.event_step || "",
    event_value: stringifyEventValue(payload.event_value || payload.value || ""),
    question_key: payload.question_key || payload.key || "",
    question_index: payload.question_index || "",
    question_count: payload.question_count || "",
    result_type: payload.result_type || resultType || "",
    lead_score: leadScore,
    lead_quality: calculateLeadQuality(leadScore),
    email_present: Boolean(answers.email),
    instagram_present: Boolean(answers.instagram_handle),
    pet_type: answers.pet_type || "",
    interest_level: answers.interest_level || "",
    willingness_to_pay: answers.willingness_to_pay || "",
    ...attribution,
    page_path: window.location.pathname + window.location.hash,
    page_title: document.title,
    viewport_width: window.innerWidth,
    viewport_height: window.innerHeight,
    device_type: window.innerWidth < 768 ? "mobile" : "desktop",
    event_payload_json: JSON.stringify(eventPayload),
  };
}

function queueAnalyticsEvent(payload) {
  if (!GOOGLE_APPS_SCRIPT_WEB_APP_URL || GOOGLE_APPS_SCRIPT_WEB_APP_URL.includes("PASTE_YOUR")) {
    return;
  }
  if (!ENABLE_FUNNEL_ANALYTICS) {
    return;
  }

  const pending = getPendingEvents();
  pending.push(payload);
  localStorage.setItem(STORAGE_KEYS.pendingEvents, JSON.stringify(pending.slice(-100)));
  sendAnalyticsEvent(payload).then(() => {
    removePendingEvent(payload.event_id);
  }).catch(() => {});
}

async function sendAnalyticsEvent(payload) {
  await fetch(GOOGLE_APPS_SCRIPT_WEB_APP_URL, {
    method: "POST",
    mode: "no-cors",
    keepalive: true,
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });
}

async function retryPendingEvents() {
  if (!GOOGLE_APPS_SCRIPT_WEB_APP_URL || GOOGLE_APPS_SCRIPT_WEB_APP_URL.includes("PASTE_YOUR")) {
    return;
  }
  if (!ENABLE_FUNNEL_ANALYTICS) {
    return;
  }

  const pending = getPendingEvents();
  if (!pending.length) return;
  for (const payload of pending.slice(0, 20)) {
    try {
      await sendAnalyticsEvent(payload);
      removePendingEvent(payload.event_id);
    } catch (error) {
      break;
    }
  }
}

function getPendingEvents() {
  return safeParse(localStorage.getItem(STORAGE_KEYS.pendingEvents), []);
}

function removePendingEvent(eventId) {
  const remaining = getPendingEvents().filter((event) => event.event_id !== eventId);
  localStorage.setItem(STORAGE_KEYS.pendingEvents, JSON.stringify(remaining));
}

function getOrCreateSessionId() {
  const existing = localStorage.getItem(STORAGE_KEYS.sessionId);
  if (existing) return existing;
  const id = createSubmissionId();
  localStorage.setItem(STORAGE_KEYS.sessionId, id);
  return id;
}

function sanitizeAnswersForAnalytics() {
  const { email, instagram_handle: instagramHandle, ...safeAnswers } = answers;
  return {
    ...safeAnswers,
    email_present: Boolean(email),
    instagram_present: Boolean(instagramHandle),
  };
}

function stringifyEventValue(value) {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object" && value !== null) return JSON.stringify(value);
  return value;
}

function bindEmailCaptureEvents() {
  stage.querySelectorAll("[data-field]").forEach((input) => {
    input.addEventListener("input", () => {
      if (input.type === "checkbox") {
        answers[input.dataset.field] = input.checked;
      } else {
        answers[input.dataset.field] = input.value.trim();
      }
    });
  });
}

function validateEmailCapture() {
  if (!isValidEmail(answers.email || "")) {
    showError("Enter a valid email address for the private iOS waitlist.");
    return false;
  }
  if (!answers.marketing_consent) {
    showError("Please agree to receive Horo launch and early access updates.");
    return false;
  }
  return true;
}

function getResultShareText() {
  const petType = answers.pet_type || "";
  if (resultType === "Chaos Comet") {
    return "My pet is a Chaos Comet and honestly that explains everything.";
  }
  if (resultType === "Mystery Void" && petType.includes("Cat")) {
    return "My cat is a Mystery Void. The stars confirmed what I already knew.";
  }
  if (resultType === "Mystery Void") {
    return "My pet is a Mystery Void. The stars confirmed what I already knew.";
  }
  if (resultType === "Royal Leo Paw") {
    return "My pet is a Royal Leo Paw. Main character behavior officially confirmed.";
  }
  return `My pet is a ${resultType}. Horo said what needed to be said.`;
}

async function copyText(text) {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

async function retryPendingSubmissions() {
  if (!GOOGLE_APPS_SCRIPT_WEB_APP_URL || GOOGLE_APPS_SCRIPT_WEB_APP_URL.includes("PASTE_YOUR")) {
    return;
  }

  const pending = getPendingSubmissions();
  if (!pending.length) return;

  const remaining = [];
  for (const payload of pending) {
    if (getSuccessfulSubmissionIds().includes(payload.submission_id)) continue;
    try {
      await submitPayload(payload);
      markSubmissionSuccessful(payload.submission_id);
    } catch (error) {
      remaining.push(payload);
    }
  }
  localStorage.setItem(STORAGE_KEYS.pending, JSON.stringify(remaining));
}

function queuePendingSubmission(payload) {
  const pending = getPendingSubmissions();
  const alreadyQueued = pending.some((item) => item.submission_id === payload.submission_id);
  if (!alreadyQueued) {
    pending.push(payload);
    localStorage.setItem(STORAGE_KEYS.pending, JSON.stringify(pending));
  }
}

function getPendingSubmissions() {
  return safeParse(localStorage.getItem(STORAGE_KEYS.pending), []);
}

function markSubmissionSuccessful(id) {
  const ids = new Set(getSuccessfulSubmissionIds());
  ids.add(id);
  localStorage.setItem(STORAGE_KEYS.successful, JSON.stringify([...ids]));
}

function getSuccessfulSubmissionIds() {
  return safeParse(localStorage.getItem(STORAGE_KEYS.successful), []);
}

function safeParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function showError(message) {
  errorBox.textContent = message;
  errorBox.hidden = false;
}

function clearError() {
  errorBox.textContent = "";
  errorBox.hidden = true;
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}
