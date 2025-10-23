
PLACIＤ x Digitag Pro — Dashboard & Redirect (Netlify + Apps Script)

1) Google Sheet (3 onglets)
--------------------------------
Agencies
- agency_id
- city
- review_url
- active
- plaques_count

Scans_Daily_Agency
- date (yyyy-mm-dd)
- agency_id
- scans

Scans_Log
- timestamp
- agency_id
- user_agent

2) Apps Script
--------------------------------
- Create a new Apps Script bound to your Google Sheet
- Paste Code.gs (provided in this zip) into the script editor
- Deploy as Web App: "Anyone" (public)
- Copy the Web App URL and replace it in /assets/app.js: APP_SCRIPT_BASE

QR/NFC URLs (two options)
- Recommended: directly use the Apps Script redirect URL:
  https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec?a=PLCD-CAR
- Or via Netlify forward page: /r.html?a=PLCD-CAR (it will forward to Apps Script)

3) Netlify
--------------------------------
- Deploy this folder to Netlify (drag & drop, or connect repo)
- Edit /assets/app.js, set APP_SCRIPT_BASE to your actual Apps Script URL
- Open /index.html for the dashboard
- For QR/NFC, you can use /r.html as a forwarder if you prefer a Netlify domain

4) What you can customize
--------------------------------
- /assets/style.css : colors, spacing, dark mode specifics
- /assets/app.js : which widgets to show/hide, default date range
- /index.html : layout of cards + table
- /map.html : bubble map of cities (fill cities with coordinates in assets/cities.json)

5) Notes
--------------------------------
- If CORS prevents fetch, the dashboard automatically falls back to JSONP (no CORS required).
- Keep your Sheet column names EXACTLY as above.
- Agencies.plaques_count can be a fixed number (e.g., 52) or a formula that counts rows in a Plaques tab (optional).
