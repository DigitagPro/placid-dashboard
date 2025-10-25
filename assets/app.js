
// ==== CONFIG ====
const APP_SCRIPT_BASE = "https://script.google.com/macros/s/AKfycbxGvMP72fh_PMhin5uj-Ndiin_o80eZY9Y2jMcUAnny1RyC1ZGVgZvocryWn0R3fVTLvA/exec"; // <-- REPLACE with your Apps Script Web App URL
const DEFAULT_DAYS = 30;

// Utilities
function fmt(n) { return (n||0).toLocaleString('fr-FR'); }
function ymd(d) { return d.toISOString().slice(0,10); }

// Date range
const end = new Date();
const start = new Date(Date.now() - (DEFAULT_DAYS-1)*24*3600*1000);

// DOM
const elTotal = () => document.querySelector('#kpi-total');
const elCities = () => document.querySelector('#kpi-cities');
const elMonth = () => document.querySelector('#kpi-month');
const elChange7 = () => document.querySelector('#kpi-change7');
const tbody = () => document.querySelector('#tbody-agencies');

// Load data with fetch then fallback to JSONP
async function loadStats() {
  const url = APP_SCRIPT_BASE + `?api=stats&start=${ymd(start)}&end=${ymd(end)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP '+res.status);
    const data = await res.json();
    renderAll(data);
  } catch (e) {
    // Fallback JSONP
    const cb = 'onStats_'+Date.now();
    window[cb] = (data) => { renderAll(data); };
    const s = document.createElement('script');
    s.src = url + `&callback=${cb}`;
    document.body.appendChild(s);
  }
}

function renderAll(data) {
  if (!data || !data.ok) return;
  // KPIs
  elTotal().textContent   = fmt(data.global.total_scans);
  elCities().textContent  = fmt(data.global.total_cities_active);
  elMonth().textContent   = fmt(data.global.month_total);
  elChange7().textContent = (data.global.change_7d_pct>=0?'+':'') + (data.global.change_7d_pct||0) + '%';

  // Table per agency
  tbody().innerHTML = '';
  data.per_agency.forEach(a => {
    const tr = document.createElement('tr');
    const ratio = a.plaques_count>0 ? (a.scans/a.plaques_count).toFixed(2) : '-';
    tr.innerHTML = `
      <td>${a.city}</td>
      <td>${a.agency_id}</td>
      <td>${fmt(a.scans)}</td>
      <td>${a.plaques_count}</td>
      <td>${ratio}</td>
      <td><a href="${a.review_url}" target="_blank" class="btn btn--secondary">Lien avis</a></td>`;
    tbody().appendChild(tr);
  });

  // Trend chart
  drawTrend(data.global.trend_daily);
}

// Chart (Chart.js via CDN)
function drawTrend(series) {
  const ctx = document.getElementById('trend').getContext('2d');
  const labels = series.map(x => x.date);
  const values = series.map(x => x.scans);
  if (window._trendChart) window._trendChart.destroy();
  window._trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{ label: 'Scans', data: values, fill:false, tension: .25 }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: { ticks: { maxTicksLimit: 8 } }
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  // Set date inputs
  document.querySelector('#start').value = ymd(start);
  document.querySelector('#end').value = ymd(end);
  document.querySelector('#apply').addEventListener('click', () => {
    const s = document.querySelector('#start').value;
    const e = document.querySelector('#end').value;
    const url = APP_SCRIPT_BASE + `?api=stats&start=${s}&end=${e}`;
    // reload with fetch/jsonp
    fetch(url).then(r => r.json()).then(renderAll).catch(() => {
      const cb = 'onStats_'+Date.now();
      window[cb] = (data) => renderAll(data);
      const scr = document.createElement('script');
      scr.src = url + `&callback=${cb}`;
      document.body.appendChild(scr);
    });
  });
  loadStats();
});
