/**
 * CueMaster Suite - Google Apps Script for Analytics Collection
 * Version 2.5 - Direct URL parameters (no JSON encoding)
 * 
 * SETUP INSTRUCTIONS:
 * 1. Create a new Google Sheet
 * 2. Go to Extensions > Apps Script
 * 3. DELETE all existing code and paste this entire script
 * 4. Click Save, then run initialSetup() and authorize
 * 5. Deploy > New deployment > Web app > "Anyone" access
 * 6. Copy the Web App URL
 * 
 * SHEET CREATED:
 * - "Analytics" - Gameplay and session data with device info (24 columns A-X)
 * 
 * NOTE: Feedback is collected via Google Forms, not this script
 */

function initialSetup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Create/reset Analytics sheet
  let analyticsSheet = ss.getSheetByName('Analytics');
  if (!analyticsSheet) {
    analyticsSheet = ss.insertSheet('Analytics');
  } else {
    analyticsSheet.clear();
  }
  
  analyticsSheet.appendRow([
    'Timestamp',           // A
    'User ID',             // B
    'User Email',          // C
    'Device Type',         // D
    'Browser',             // E
    'Screen Size',         // F
    'Timezone',            // G
    'Total Sessions',      // H
    'Total Time (min)',    // I
    'Tempo Avg Shot (s)',  // J
    'Tempo Total Shots',   // K
    'Tempo Sessions',      // L
    'Velocity Avg MPH',    // M
    'Velocity Max MPH',    // N
    'Velocity Breaks',     // O
    'Vectors Shots',       // P
    'Vectors Avg Power',   // Q
    'Vectors Sessions',    // R
    'TrueLevel Calibrations', // S
    'TrueLevel Tables',    // T
    'Luck Total Flips',    // U
    'Luck Heads',          // V
    'Luck Tails',          // W
    'Luck Sessions'        // X
  ]);
  analyticsSheet.getRange(1, 1, 1, 24).setFontWeight('bold');
  analyticsSheet.setFrozenRows(1);
  
  Logger.log('Setup complete! Now Deploy > New deployment > Web app > Anyone');
}

function doGet(e) {
  try {
    const action = e.parameter.action || 'ping';
    
    if (action === 'ping') {
      return jsonResponse({ status: 'ok', message: 'CueMaster Analytics v2.5' });
    }
    
    if (action === 'submit') {
      // Read individual URL parameters directly (no JSON parsing needed)
      return handleAnalyticsSubmission(e.parameter);
    }
    
    if (action === 'summary') {
      return getSummary();
    }
    
    return jsonResponse({ result: 'error', message: 'Unknown action: ' + action });
  } catch (err) {
    return jsonResponse({ result: 'error', message: 'doGet error: ' + err.toString() });
  }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents || '{}');
    return handleAnalyticsSubmission(data);
  } catch (err) {
    return jsonResponse({ result: 'error', message: 'doPost error: ' + err.toString() });
  }
}

function handleAnalyticsSubmission(params) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Analytics');
  
  if (!sheet) {
    initialSetup();
    sheet = ss.getSheetByName('Analytics');
  }
  
  // Helper to safely convert to number
  function safeNum(val) {
    if (val === null || val === undefined || val === '') return 0;
    const n = Number(val);
    return isNaN(n) ? 0 : n;
  }
  
  // Helper to safely get string
  function safeStr(val, defaultVal) {
    if (val === null || val === undefined || val === '') return defaultVal || '';
    return String(val);
  }
  
  // Format timestamp as human-readable date/time
  const now = new Date();
  const formattedTimestamp = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
  
  // Read directly from URL parameters (all flat, no nesting)
  let timezone = safeStr(params.timezone, 'unknown');
  if (timezone === 'undefined' || timezone === 'null') timezone = 'unknown';
  
  // Build row from individual URL parameters
  const row = [
    formattedTimestamp,                           // A: Timestamp
    safeStr(params.userId, 'anonymous'),          // B: User ID
    safeStr(params.userEmail, ''),                // C: User Email
    safeStr(params.deviceType, 'unknown'),        // D: Device Type
    safeStr(params.browser, 'unknown'),           // E: Browser
    safeStr(params.screenSize, 'unknown'),        // F: Screen Size
    timezone,                                     // G: Timezone
    safeNum(params.totalSessions),                // H: Total Sessions
    Math.round(safeNum(params.totalTimeMs) / 60000), // I: Total Time (min)
    safeNum(params.tempoAvgShotTime),             // J: Tempo Avg Shot (s)
    safeNum(params.tempoTotalShots),              // K: Tempo Total Shots
    safeNum(params.tempoSessions),                // L: Tempo Sessions
    safeNum(params.velocityAvgSpeed),             // M: Velocity Avg MPH
    safeNum(params.velocityMaxSpeed),             // N: Velocity Max MPH
    safeNum(params.velocityBreaks),               // O: Velocity Breaks
    safeNum(params.vectorsShots),                 // P: Vectors Shots
    safeNum(params.vectorsAvgPower),              // Q: Vectors Avg Power
    safeNum(params.vectorsSessions),              // R: Vectors Sessions
    safeNum(params.truelevelCalibrations),        // S: TrueLevel Calibrations
    safeNum(params.truelevelTables),              // T: TrueLevel Tables
    safeNum(params.luckFlips),                    // U: Luck Total Flips
    safeNum(params.luckHeads),                    // V: Luck Heads
    safeNum(params.luckTails),                    // W: Luck Tails
    safeNum(params.luckSessions)                  // X: Luck Sessions
  ];
  
  sheet.appendRow(row);
  
  return jsonResponse({ 
    result: 'success', 
    message: 'Analytics recorded v2.5',
    columns: row.length
  });
}

function getSummary() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const analyticsSheet = ss.getSheetByName('Analytics');
  
  const summary = {
    analyticsCount: 0,
    totalSessions: 0,
    totalTimeHours: 0,
    avgBreakSpeed: 0,
    maxBreakSpeed: 0,
    totalTempoShots: 0,
    totalVelocityBreaks: 0
  };
  
  if (analyticsSheet) {
    const data = analyticsSheet.getDataRange().getValues();
    summary.analyticsCount = Math.max(0, data.length - 1);
    
    if (summary.analyticsCount > 0) {
      let totalTime = 0, totalBreakSpeed = 0, maxBreak = 0, tempoShots = 0, velocityBreaks = 0, sessions = 0;
      
      for (let i = 1; i < data.length; i++) {
        sessions += Number(data[i][7]) || 0;        // H: Total Sessions
        totalTime += Number(data[i][8]) || 0;       // I: Total Time (min)
        tempoShots += Number(data[i][10]) || 0;     // K: Tempo Total Shots
        totalBreakSpeed += Number(data[i][12]) || 0; // M: Velocity Avg MPH
        maxBreak = Math.max(maxBreak, Number(data[i][13]) || 0); // N: Velocity Max MPH
        velocityBreaks += Number(data[i][14]) || 0; // O: Velocity Breaks
      }
      
      summary.totalSessions = sessions;
      summary.totalTimeHours = Math.round(totalTime / 60 * 10) / 10;
      summary.avgBreakSpeed = summary.analyticsCount > 0 ? Math.round(totalBreakSpeed / summary.analyticsCount * 10) / 10 : 0;
      summary.maxBreakSpeed = maxBreak;
      summary.totalTempoShots = tempoShots;
      summary.totalVelocityBreaks = velocityBreaks;
    }
  }
  
  return jsonResponse({ result: 'success', summary: summary });
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
