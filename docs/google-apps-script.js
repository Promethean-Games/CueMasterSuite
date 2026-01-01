/**
 * CueMaster Suite - Google Apps Script for Analytics Collection
 * Version 3.0 - Complete module data with user info
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
 * - "Analytics" - Complete user and gameplay data (28 columns A-AB)
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
    'User Name',           // D
    'Signed In',           // E
    'Pro Enabled',         // F
    'Promo Code',          // G
    'Device Type',         // H
    'Browser',             // I
    'Screen Size',         // J
    'Location/Timezone',   // K
    'Total Sessions',      // L
    'Total Time (min)',    // M
    'Tempo Avg Shot (s)',  // N
    'Tempo Total Shots',   // O
    'Tempo Sessions',      // P
    'Last Break Speed',    // Q
    'Velocity Avg MPH',    // R
    'Velocity Max MPH',    // S
    'Velocity Breaks',     // T
    'Vectors Shots',       // U
    'Vectors Sessions',    // V
    'Lean Calibrations',   // W
    'Lean Tables',         // X
    'Coin Tosses',         // Y
    'Coins Heads',         // Z
    'Coins Tails',         // AA
    'Luck Sessions'        // AB
  ]);
  analyticsSheet.getRange(1, 1, 1, 28).setFontWeight('bold');
  analyticsSheet.setFrozenRows(1);
  
  Logger.log('Setup complete! Now Deploy > New deployment > Web app > Anyone');
}

function doGet(e) {
  try {
    const action = e.parameter.action || 'ping';
    
    if (action === 'ping') {
      return jsonResponse({ status: 'ok', message: 'CueMaster Analytics v3.0' });
    }
    
    if (action === 'submit') {
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
  
  // Helper for boolean
  function safeBool(val) {
    if (val === 'true' || val === true || val === '1') return 'Yes';
    return 'No';
  }
  
  // Format timestamp as human-readable date/time
  const now = new Date();
  const formattedTimestamp = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
  
  // Read directly from URL parameters
  let timezone = safeStr(params.timezone, 'unknown');
  if (timezone === 'undefined' || timezone === 'null') timezone = 'unknown';
  
  // Build row from individual URL parameters
  const row = [
    formattedTimestamp,                             // A: Timestamp
    safeStr(params.userId, 'anonymous'),            // B: User ID
    safeStr(params.userEmail, ''),                  // C: User Email
    safeStr(params.userName, ''),                   // D: User Name
    safeBool(params.isSignedIn),                    // E: Signed In
    safeBool(params.isPro),                         // F: Pro Enabled
    safeStr(params.promoCode, ''),                  // G: Promo Code
    safeStr(params.deviceType, 'unknown'),          // H: Device Type
    safeStr(params.browser, 'unknown'),             // I: Browser
    safeStr(params.screenSize, 'unknown'),          // J: Screen Size
    timezone,                                       // K: Location/Timezone
    safeNum(params.totalSessions),                  // L: Total Sessions
    Math.round(safeNum(params.totalTimeMs) / 60000), // M: Total Time (min)
    safeNum(params.tempoAvgShotTime),               // N: Tempo Avg Shot (s)
    safeNum(params.tempoTotalShots),                // O: Tempo Total Shots
    safeNum(params.tempoSessions),                  // P: Tempo Sessions
    safeNum(params.lastBreakSpeed),                 // Q: Last Break Speed
    safeNum(params.velocityAvgSpeed),               // R: Velocity Avg MPH
    safeNum(params.velocityMaxSpeed),               // S: Velocity Max MPH
    safeNum(params.velocityBreaks),                 // T: Velocity Breaks
    safeNum(params.vectorsShots),                   // U: Vectors Shots
    safeNum(params.vectorsSessions),                // V: Vectors Sessions
    safeNum(params.leanCalibrations),               // W: Lean Calibrations
    safeNum(params.leanTables),                     // X: Lean Tables
    safeNum(params.luckFlips),                      // Y: Coin Tosses
    safeNum(params.luckHeads),                      // Z: Coins Heads
    safeNum(params.luckTails),                      // AA: Coins Tails
    safeNum(params.luckSessions)                    // AB: Luck Sessions
  ];
  
  sheet.appendRow(row);
  
  return jsonResponse({ 
    result: 'success', 
    message: 'Analytics recorded v3.0',
    columns: row.length
  });
}

function getSummary() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const analyticsSheet = ss.getSheetByName('Analytics');
  
  const summary = {
    analyticsCount: 0,
    totalUsers: 0,
    proUsers: 0,
    signedInUsers: 0,
    totalSessions: 0,
    totalTimeHours: 0,
    avgShotTime: 0,
    totalShots: 0,
    avgBreakSpeed: 0,
    maxBreakSpeed: 0,
    totalBreaks: 0,
    totalCoinTosses: 0,
    totalHeads: 0,
    totalTails: 0
  };
  
  if (analyticsSheet) {
    const data = analyticsSheet.getDataRange().getValues();
    summary.analyticsCount = Math.max(0, data.length - 1);
    
    if (summary.analyticsCount > 0) {
      let totalTime = 0, totalBreakSpeed = 0, maxBreak = 0;
      let tempoShots = 0, velocityBreaks = 0, sessions = 0;
      let avgShotTimeSum = 0, coinTosses = 0, heads = 0, tails = 0;
      let proCount = 0, signedInCount = 0;
      const uniqueUsers = new Set();
      
      for (let i = 1; i < data.length; i++) {
        uniqueUsers.add(data[i][1]);                   // B: User ID
        if (data[i][4] === 'Yes') signedInCount++;     // E: Signed In
        if (data[i][5] === 'Yes') proCount++;          // F: Pro Enabled
        sessions += Number(data[i][11]) || 0;          // L: Total Sessions
        totalTime += Number(data[i][12]) || 0;         // M: Total Time (min)
        avgShotTimeSum += Number(data[i][13]) || 0;    // N: Tempo Avg Shot (s)
        tempoShots += Number(data[i][14]) || 0;        // O: Tempo Total Shots
        totalBreakSpeed += Number(data[i][17]) || 0;   // R: Velocity Avg MPH
        maxBreak = Math.max(maxBreak, Number(data[i][18]) || 0); // S: Velocity Max MPH
        velocityBreaks += Number(data[i][19]) || 0;    // T: Velocity Breaks
        coinTosses += Number(data[i][24]) || 0;        // Y: Coin Tosses
        heads += Number(data[i][25]) || 0;             // Z: Coins Heads
        tails += Number(data[i][26]) || 0;             // AA: Coins Tails
      }
      
      summary.totalUsers = uniqueUsers.size;
      summary.proUsers = proCount;
      summary.signedInUsers = signedInCount;
      summary.totalSessions = sessions;
      summary.totalTimeHours = Math.round(totalTime / 60 * 10) / 10;
      summary.avgShotTime = summary.analyticsCount > 0 ? Math.round(avgShotTimeSum / summary.analyticsCount * 100) / 100 : 0;
      summary.totalShots = tempoShots;
      summary.avgBreakSpeed = summary.analyticsCount > 0 ? Math.round(totalBreakSpeed / summary.analyticsCount * 10) / 10 : 0;
      summary.maxBreakSpeed = maxBreak;
      summary.totalBreaks = velocityBreaks;
      summary.totalCoinTosses = coinTosses;
      summary.totalHeads = heads;
      summary.totalTails = tails;
    }
  }
  
  return jsonResponse({ result: 'success', summary: summary });
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
