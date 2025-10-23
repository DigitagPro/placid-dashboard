
/**
 * PLACID x Digitag Pro — Redirect + Stats API (JSON + JSONP)
 * Bind this script to your Google Sheet (Agencies, Scans_Daily_Agency, Scans_Log).
 */

function doGet(e){
  // Route: redirect /r?a=AGENCY
  if (e && e.parameter && e.parameter.a && !e.parameter.api) {
    return handleRedirect_(e);
  }
  // Route: stats JSON/JSONP
  if (e && e.parameter && e.parameter.api === "stats") {
    return handleStatsApi_(e);
  }
  // Route: export CSV
  if (e && e.parameter && e.parameter.api === "export") {
    return handleExport_(e);
  }
  return _json({ ok:false, error:"No route" }, e);
}

function handleRedirect_(e){
  var agency = (e && e.parameter && e.parameter.a) ? (""+e.parameter.a).trim() : "";
  if (!agency) return _html("Paramètre ?a manquant.");
  var ss = SpreadsheetApp.getActive();
  var shAg = ss.getSheetByName("Agencies");
  var shDaily = ss.getSheetByName("Scans_Daily_Agency");
  var shLog   = ss.getSheetByName("Scans_Log");

  // Load Agencies
  var agVals = shAg.getDataRange().getValues();
  var head = agVals.shift();
  var iId = head.indexOf("agency_id");
  var iCity = head.indexOf("city");
  var iUrl = head.indexOf("review_url");
  var iAct = head.indexOf("active");

  var row = null;
  for (var i=0;i<agVals.length;i++){
    if ((agVals[i][iId]+"").trim() === agency) { row = agVals[i]; break; }
  }
  if (!row) return _html("Agence inconnue: "+agency);

  var active = (row[iAct]===true) || ((""+row[iAct]).toUpperCase()==="TRUE");
  if (!active) return _html("Agence inactive.");

  var city = (row[iCity]+"").trim();
  var baseUrl = (row[iUrl]+"").trim();
  if (!baseUrl) return _html("URL d'avis non configurée.");

  // UTM
  var finalUrl = baseUrl + (baseUrl.indexOf("?")>-1 ? "&" : "?") +
    "utm_source=placid&utm_medium=plaque&utm_campaign="+encodeURIComponent(city);

  // Count daily
  var tz = Session.getScriptTimeZone();
  var today = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd");
  _incDaily(shDaily, today, agency);

  // Log
  var ua = (e && e.parameter && e.parameter.ua) ? (""+e.parameter.ua) : "";
  shLog.appendRow([new Date(), agency, ua]);

  return _redirect(finalUrl);
}

function handleStatsApi_(e){
  var ss = SpreadsheetApp.getActive();
  var shAg = ss.getSheetByName("Agencies");
  var shDaily = ss.getSheetByName("Scans_Daily_Agency");
  var shLog = ss.getSheetByName("Scans_Log");

  var tz = Session.getScriptTimeZone();
  var today = new Date();
  var end = e.parameter.end ? new Date(e.parameter.end) : today;
  var start = e.parameter.start ? new Date(e.parameter.start) : new Date(end.getTime() - 29*24*3600*1000);

  // Agencies
  var agVals = shAg.getDataRange().getValues();
  var agHead = agVals.shift();
  var idxA = agHead.indexOf("agency_id");
  var idxC = agHead.indexOf("city");
  var idxU = agHead.indexOf("review_url");
  var idxAct = agHead.indexOf("active");
  var idxPC = agHead.indexOf("plaques_count");

  var agencies = {};
  var totalCitiesActive = 0;
  agVals.forEach(function(r){
    var id = (r[idxA] + "").trim();
    if (!id) return;
    var active = (r[idxAct]===true) || ((""+r[idxAct]).toUpperCase()==="TRUE");
    agencies[id] = {
      agency_id: id,
      city: (r[idxC]+"").trim(),
      review_url: (r[idxU]+"").trim(),
      active: active,
      plaques_count: Number(r[idxPC]||0)
    };
    if (active) totalCitiesActive++;
  });

  // Daily
  var dVals = shDaily.getDataRange().getValues();
  var dHead = dVals.shift();
  var idxD_date = dHead.indexOf("date");
  var idxD_ag = dHead.indexOf("agency_id");
  var idxD_sc = dHead.indexOf("scans");

  var byDayGlobal = {};
  var byAgency = {};
  dVals.forEach(function(r){
    var dt = r[idxD_date];
    if (!dt) return;
    var day = (dt instanceof Date) ? Utilities.formatDate(dt, tz, "yyyy-MM-dd") : (""+dt);
    var t = new Date(day+"T00:00:00");
    if (t < start || t > end) return;
    var a = (r[idxD_ag]+"").trim();
    var sc = Number(r[idxD_sc]||0);
    byDayGlobal[day] = (byDayGlobal[day]||0) + sc;
    byAgency[a] = (byAgency[a]||0) + sc;
  });

  var trend = [];
  for (var d=new Date(start); d<=end; d=new Date(d.getTime()+24*3600*1000)){
    var key = Utilities.formatDate(d, tz, "yyyy-MM-dd");
    trend.push({date:key, scans:(byDayGlobal[key]||0)});
  }
  var totalScans = trend.reduce(function(s,x){ return s + x.scans; }, 0);
  var monthKey = Utilities.formatDate(end, tz, "yyyy-MM");
  var monthTotal = trend.filter(function(x){ return x.date.slice(0,7)===monthKey; })
                        .reduce(function(s,x){ return s + x.scans; }, 0);

  var top5 = Object.keys(byAgency).map(function(a){
    return { agency_id:a, city:(agencies[a]&&agencies[a].city)||a, scans:byAgency[a]||0 };
  }).sort(function(x,y){ return y.scans - x.scans; }).slice(0,5);

  // 7-day change
  var end7 = new Date(end);
  var start7 = new Date(end.getTime() - 6*24*3600*1000);
  var prevEnd7 = new Date(start7.getTime() - 24*3600*1000);
  var prevStart7 = new Date(prevEnd7.getTime() - 6*24*3600*1000);

  function sumRange(sdt, edt){
    var sum=0;
    for (var d=new Date(sdt); d<=edt; d=new Date(d.getTime()+24*3600*1000)){
      var k = Utilities.formatDate(d, tz, "yyyy-MM-dd");
      sum += (byDayGlobal[k]||0);
    }
    return sum;
  }
  var now7 = sumRange(start7, end7);
  var last7 = sumRange(prevStart7, prevEnd7);
  var change7 = (last7>0) ? ((now7 - last7)/last7)*100 : (now7>0 ? 100 : 0);

  var perAgency = Object.keys(agencies).map(function(id){
    return {
      agency_id: id,
      city: agencies[id].city,
      active: agencies[id].active,
      review_url: agencies[id].review_url,
      plaques_count: agencies[id].plaques_count,
      scans: byAgency[id]||0
    };
  }).sort(function(a,b){ return b.scans - a.scans; });

  var payload = {
    ok:true,
    period: { start: formatYMD_(start, tz), end: formatYMD_(end, tz) },
    global: {
      total_scans: totalScans,
      total_cities_active: totalCitiesActive,
      month_total: monthTotal,
      trend_daily: trend,
      change_7d_pct: Math.round(change7*100)/100
    },
    top5_cities: top5,
    per_agency: perAgency,
    tech: buildTechStats_(shLog, start, end, tz)
  };

  return _json(payload, e);
}

function buildTechStats_(shLog, start, end, tz){
  var vals = shLog.getDataRange().getValues();
  if (!vals.length) return {devices:{}, browsers:{}, os:{}, hours:{}, weekdays:{}};
  var head = vals.shift();
  var iTs = head.indexOf("timestamp");
  var iUA = head.indexOf("user_agent");

  var devices={}, browsers={}, os={}, hours={}, weekdays={};
  vals.forEach(function(r){
    var ts = r[iTs]; if (!ts) return;
    var t = (ts instanceof Date) ? ts : new Date(ts);
    if (t < start || t > end) return;
    var ua = (r[iUA]+"").toLowerCase();

    var device = "desktop";
    if (ua.indexOf("iphone")>-1 || (ua.indexOf("android")>-1 && ua.indexOf("mobile")>-1)) device = "mobile";
    else if (ua.indexOf("ipad")>-1 || (ua.indexOf("android")>-1 && ua.indexOf("tablet")>-1)) device = "tablet";
    devices[device] = (devices[device]||0)+1;

    var browser = "autre";
    if (ua.indexOf("edg")>-1) browser = "edge";
    else if (ua.indexOf("chrome")>-1 && ua.indexOf("safari")>-1) browser = "chrome";
    else if (ua.indexOf("safari")>-1 && ua.indexOf("chrome")==-1) browser = "safari";
    else if (ua.indexOf("firefox")>-1) browser = "firefox";
    browsers[browser] = (browsers[browser]||0)+1;

    var sys = "autre";
    if (ua.indexOf("iphone")>-1 || ua.indexOf("ipad")>-1) sys="iOS";
    else if (ua.indexOf("android")>-1) sys="Android";
    else if (ua.indexOf("windows")>-1) sys="Windows";
    else if (ua.indexOf("macintosh")>-1) sys="macOS";
    os[sys] = (os[sys]||0)+1;

    var h = Utilities.formatDate(t, tz, "HH");
    hours[h] = (hours[h]||0)+1;

    var wd = t.getDay(); // 0=Sun..6=Sat; map to 1..7
    var map = {0:7,1:1,2:2,3:3,4:4,5:5,6:6};
    var w = map[wd];
    weekdays[w] = (weekdays[w]||0)+1;
  });
  return {devices, browsers, os, hours, weekdays};
}

function handleExport_(e){
  var scope = (e.parameter.scope||"per_agency"); // "per_agency" | "daily" | "log"
  var ss = SpreadsheetApp.getActive();
  var sh;
  if (scope==="daily") sh = ss.getSheetByName("Scans_Daily_Agency");
  else if (scope==="log") sh = ss.getSheetByName("Scans_Log");
  else sh = ss.getSheetByName("Agencies");
  var csv = toCsv_(sh.getDataRange().getValues());
  return ContentService.createTextOutput(csv).setMimeType(ContentService.MimeType.CSV);
}

// ---- Helpers
function _incDaily(shDaily, dateStr, agencyId){
  var data = shDaily.getDataRange().getValues();
  if (data.length === 0) {
    shDaily.appendRow(["date","agency_id","scans"]);
    data = shDaily.getDataRange().getValues();
  }
  var header = data.shift();
  var map = {};
  for (var i=0;i<data.length;i++){
    var k = data[i][0]+"|"+data[i][1];
    map[k] = {row:i+2, scans:Number(data[i][2]||0)};
  }
  var key = dateStr + "|" + agencyId;
  if (map[key]){
    var newVal = map[key].scans + 1;
    shDaily.getRange(map[key].row, 3).setValue(newVal);
  } else {
    shDaily.appendRow([dateStr, agencyId, 1]);
  }
}

function _redirect(url){
  var html = HtmlService.createHtmlOutput(
    '<!doctype html><html><head><meta charset="utf-8">'+
    '<meta name="viewport" content="width=device-width,initial-scale=1"></head><body>'+
    '<script>window.location.replace('+JSON.stringify(url)+');</script>'+
    '<noscript><a href="'+url+'">Continuer</a></noscript>'+
    '</body></html>'
  );
  html.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  return html;
}

function _html(msg){
  return HtmlService.createHtmlOutput('<pre style="font:14px/1.4 monospace;padding:16px">'+msg+'</pre>');
}

function _json(obj, e){
  var cb = e && e.parameter && e.parameter.callback;
  if (cb) {
    // JSONP
    var out = cb + '(' + JSON.stringify(obj) + ')';
    return ContentService.createTextOutput(out).setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function toCsv_(rows){
  return rows.map(function(r){
    return r.map(function(cell){
      var s = (cell===null||cell===undefined) ? "" : (""+cell);
      if (s.indexOf('"')>-1 || s.indexOf(',')>-1 || s.indexOf('\n')>-1) s = '"'+s.replace(/"/g,'""')+'"';
      return s;
    }).join(",");
  }).join("\n");
}

function formatYMD_(d, tz){ return Utilities.formatDate(d, tz, "yyyy-MM-dd"); }
