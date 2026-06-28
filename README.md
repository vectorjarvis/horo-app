# Horo Landing Page

Horo is a static GitHub Pages landing page for validating demand for an upcoming iOS app: playful horoscopes and personality readings for dogs, cats, and emotionally complicated pets.

The page includes a mobile-first marketing layout, an interactive multi-step quiz, result teaser logic, email waitlist capture, lead scoring, UTM capture, funnel analytics events, local failed-submission fallback, and a Google Apps Script receiver for Google Sheets.

## File Structure

```text
.
├── index.html
├── privacy.html
├── terms.html
├── contact.html
├── styles.css
├── app.js
├── google-apps-script.js
└── README.md
```

## Local Testing

Open `index.html` directly in a browser, or run a tiny static server:

```bash
python3 -m http.server 8000
```

Then visit:

```text
http://localhost:8000
```

The quiz works without a backend. Submissions will be saved to `localStorage` until a real Google Apps Script Web App URL is added in `app.js`.

## Google Apps Script Setup

1. Create a Google Sheet.
2. Open `Extensions` > `Apps Script`.
3. Paste the contents of `google-apps-script.js`.
4. Save the script.
5. Run `setupSheet`.
6. Approve the requested permissions.
7. Choose `Deploy` > `New deployment` > `Web app`.
8. Set `Execute as` to `Me`.
9. Set `Who has access` to `Anyone`.
10. Deploy and copy the Web App URL.
11. In `app.js`, replace:

```js
const GOOGLE_APPS_SCRIPT_WEB_APP_URL = "PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE";
```

with your deployed URL.

Running `setupSheet` creates three tabs:

- `Horo Leads`: completed waitlist submissions with quiz answers and lead score.
- `Horo Sessions`: one row per visitor/session, with counters for page views, CTA clicks, quiz starts, question views, question answers, completions, result views, email submit attempts, successful submissions, errors, share clicks, copy actions, and scroll depth.
- `Horo Metrics`: spreadsheet formulas for core funnel counts and conversion rates.

## GitHub Pages Deployment

1. Push these files to a GitHub repository.
2. Open repository `Settings` > `Pages`.
3. Choose the branch to deploy, usually `main`.
4. Choose `/ (root)` as the folder.
5. Save.
6. Open the Pages URL when the deployment finishes.

The page uses relative paths only, so it works on project URLs such as:

```text
https://username.github.io/horo/
```

## Export Leads to Excel

In Google Sheets:

1. Open `File` > `Download`.
2. Choose `Microsoft Excel (.xlsx)`.

The `Horo Leads`, `Horo Sessions`, and `Horo Metrics` tabs export into the workbook.

## Funnel Analytics

The app records analytics to the `Horo Sessions` tab through the same Google Apps Script endpoint. No third-party analytics service is required. To keep the spreadsheet readable, it updates one row per session instead of creating one row per event.

Use the tabs this way:

- `Horo Metrics`: start here. This is the dashboard for funnel counts and conversion rates.
- `Horo Leads`: one row per completed waitlist signup.
- `Horo Sessions`: one row per visitor/session with counters. This is raw supporting data for the metrics tab.

Run `setupSheet` after updating the Apps Script. It will create a `Horo Metrics` tab with formulas for the core funnel.

After redeploying the updated Apps Script and running `setupSheet`, turn analytics on in `app.js`:

```js
const ENABLE_FUNNEL_ANALYTICS = true;
```

Keep it `false` until the deployed Apps Script supports the `Horo Sessions` tab. That prevents analytics payloads from being written into the leads sheet by an older deployment.

If you see many mostly blank `Weak` rows in `Horo Leads`, analytics was enabled against the old lead-only Apps Script deployment. Turn `ENABLE_FUNNEL_ANALYTICS` back to `false`, redeploy the updated Apps Script, run `setupSheet`, then delete the mostly blank test rows from `Horo Leads`.

Useful validation metrics:

- Landing visits: count `page_view`.
- Link/CTA interest: count `primary_cta_clicked` and `link_clicked`.
- Quiz start rate: `quiz_started / page_view`.
- Question drop-off: compare `question_viewed` counts by `question_index`.
- Quiz completion rate: `quiz_completed / quiz_started`.
- Result view rate: `result_viewed / quiz_started`.
- Email intent rate: `email_submitted / result_viewed`.
- Waitlist conversion rate: `submission_success / page_view` and `submission_success / quiz_started`.
- Lead quality mix: count `Hot`, `Warm`, `Curious`, and `Weak` in `Horo Leads`.
- Feature demand: review `desired_features` in `Horo Leads`.
- Pricing signal: count `willingness_to_pay` in `Horo Leads`.
- Source quality: compare UTM fields against `submission_success`, `lead_score`, and `lead_quality`.
- Share intent: count `share_clicked` and `result_copied`.

## Change Landing Page Copy

Edit the visible marketing sections in `index.html`:

- Hero headline and subheadline
- Social proof-style teaser lines
- Feature cards
- Footer copy

Keep claims entertainment-focused. Horo should not make medical, veterinary, or behavioral promises.

## Change Survey Questions

Edit the `quizQuestions` array in `app.js`. Each question needs:

- `key`
- `type`
- `question`
- `options` for single-choice and multi-choice questions

If you add a new field that should be saved to Google Sheets, also add the same key to `HEADERS` in `google-apps-script.js` and include it in `buildPayload()` in `app.js`.

## Test Email Collection

1. Deploy the Apps Script Web App.
2. Paste the URL into `app.js`.
3. Open the site in a browser.
4. Complete the quiz with a valid email.
5. Confirm a new row appears in the `Horo Leads` sheet.
6. Test with UTM parameters, for example:

```text
https://username.github.io/horo/?utm_source=instagram&utm_medium=bio&utm_campaign=waitlist
```

## Troubleshooting

If submissions do not appear in Google Sheets, confirm the Web App was deployed with access set to `Anyone` and that `GOOGLE_APPS_SCRIPT_WEB_APP_URL` is not still the placeholder.

If Apps Script returns permission errors, run `setupSheet` manually from the Apps Script editor and approve access.

If a submission fails, the page stores it in `localStorage` under `horo_pending_submissions` and retries on the next page load after a valid endpoint is configured.

If you change sheet columns, run `setupSheet` again or confirm the first row matches the `HEADERS` array.

If analytics sessions do not appear, redeploy the Apps Script Web App after updating `google-apps-script.js`, then run `setupSheet` again so the `Horo Sessions` and `Horo Metrics` tabs exist.
