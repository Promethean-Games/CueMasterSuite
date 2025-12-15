// ===========================================
// CueMaster Analytics - Google Apps Script
// ===========================================
// 
// SETUP INSTRUCTIONS:
// 1. Create a new Google Sheet
// 2. Go to Extensions → Apps Script
// 3. Delete the default code and paste this entire file
// 4. Click Run → initialSetup (authorize when prompted)
// 5. Click Deploy → New deployment
// 6. Select "Web app", set "Who has access" to "Anyone"
// 7. Copy the Web App URL
// 8. Set VITE_ANALYTICS_ENDPOINT in your app's environment
//
// ===========================================

const SHEET_NAME = 'Analytics';
const SCRIPT_PROP = PropertiesService.getScriptProperties();

// Run this ONCE to initialize
function initialSetup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  SCRIPT_PROP.setProperty('key', ss.getId());
  
  // Create Analytics sheet if it doesn't exist
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  
  // Set up headers
  const headers = [
    'Timestamp',
    'Anonymous ID',
    'Total Sessions',
    'Total Time (min)',
    'Tempo Avg Shot (s)',
    'Tempo Total Shots',
    'Tempo Sessions',
    'Velocity Avg MPH',
    'Velocity Max MPH',
    'Velocity Breaks',
    'Vectors Shots',
    'TrueLevel Calibrations',
    'Module Usage'
  ];
  
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  
  // Format header row
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#4285f4');
  headerRange.setFontColor('#ffffff');
  
  Logger.log('Setup complete! Spreadsheet ID: ' + ss.getId());
}

// Handles both GET and POST requests
// GET with ?action=submit&data=... for data submission (workaround for CORS)
// GET with ?action=summary for aggregate stats
// POST with JSON body for data submission
function doGet(e) {
  const action = e.parameter.action;
  
  if (action === 'submit') {
    // Handle data submission via GET (CORS workaround)
    try {
      const dataParam = e.parameter.data;
      if (!dataParam) {
        return jsonResponse({ result: 'error', message: 'No data provided' });
      }
      const data = JSON.parse(decodeURIComponent(dataParam));
      return processSubmission(data);
    } catch (err) {
      return jsonResponse({ result: 'error', message: 'Invalid data: ' + err.toString() });
    }
  }
  
  if (action === 'summary') {
    return getSummary();
  }
  
  return jsonResponse({ 
    status: 'ok', 
    message: 'CueMaster Analytics Endpoint',
    actions: ['submit', 'summary']
  });
}

// Handles POST requests
function doPost(e) {
  try {
    let data;
    
    // Try to parse JSON from POST body
    if (e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    } else if (e.parameter && e.parameter.data) {
      // Fallback to URL parameter
      data = JSON.parse(decodeURIComponent(e.parameter.data));
    } else {
      return jsonResponse({ result: 'error', message: 'No data provided' });
    }
    
    return processSubmission(data);
  } catch (err) {
    return jsonResponse({ result: 'error', message: 'Error: ' + err.toString() });
  }
}

// Process and store the submission
function processSubmission(data) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);
  
  try {
    const doc = SpreadsheetApp.openById(SCRIPT_PROP.getProperty('key'));
    const sheet = doc.getSheetByName(SHEET_NAME);
    
    if (!sheet) {
      return jsonResponse({ result: 'error', message: 'Analytics sheet not found. Run initialSetup first.' });
    }
    
    // Calculate totals
    const moduleUsage = data.moduleUsage || {};
    let totalSessions = 0;
    let totalTimeMs = 0;
    for (const key in moduleUsage) {
      totalSessions += moduleUsage[key].sessions || 0;
      totalTimeMs += moduleUsage[key].timeMs || 0;
    }
    const totalTimeMin = Math.round(totalTimeMs / 60000 * 10) / 10;
    
    const skills = data.skillMetrics || {};
    const tempo = skills.tempo || {};
    const velocity = skills.velocity || {};
    const vectors = skills.vectors || {};
    const truelevel = skills.truelevel || {};
    
    // Build row
    const row = [
      data.timestamp || new Date().toISOString(),
      data.anonymousId || 'unknown',
      totalSessions,
      totalTimeMin,
      Math.round((tempo.avgShotTime || 0) * 10) / 10,
      tempo.totalShots || 0,
      tempo.sessionsPlayed || 0,
      Math.round((velocity.avgBreakSpeed || 0) * 10) / 10,
      Math.round((velocity.maxBreakSpeed || 0) * 10) / 10,
      velocity.breaksRecorded || 0,
      vectors.shotsSimulated || 0,
      truelevel.calibrationsPerformed || 0,
      JSON.stringify(moduleUsage)
    ];
    
    // Append row
    sheet.appendRow(row);
    
    return jsonResponse({ result: 'success', row: sheet.getLastRow() });
    
  } catch (error) {
    return jsonResponse({ result: 'error', message: error.toString() });
    
  } finally {
    lock.releaseLock();
  }
}

function getSummary() {
  try {
    const doc = SpreadsheetApp.openById(SCRIPT_PROP.getProperty('key'));
    const sheet = doc.getSheetByName(SHEET_NAME);
    
    if (!sheet) {
      return jsonResponse({ error: 'Analytics sheet not found' });
    }
    
    const data = sheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      return jsonResponse({
        totalSubmissions: 0,
        uniqueUsers: 0,
        aggregateStats: {
          totalSessions: 0,
          totalTimeHours: 0,
          avgShotTime: 0,
          avgBreakSpeed: 0,
          maxBreakSpeed: 0,
          totalBreaks: 0,
          totalShots: 0,
          totalCalibrations: 0
        },
        recentSubmissions: []
      });
    }
    
    const rows = data.slice(1); // Skip header
    const uniqueUsers = [...new Set(rows.map(r => r[1]))].length;
    
    let totalSessions = 0;
    let totalTimeMin = 0;
    let totalShots = 0;
    let totalShotTime = 0;
    let totalBreaks = 0;
    let totalBreakSpeed = 0;
    let maxBreakSpeed = 0;
    let totalCalibrations = 0;
    
    rows.forEach(row => {
      totalSessions += Number(row[2]) || 0;
      totalTimeMin += Number(row[3]) || 0;
      
      const avgShot = Number(row[4]) || 0;
      const shots = Number(row[5]) || 0;
      if (shots > 0) {
        totalShots += shots;
        totalShotTime += avgShot * shots;
      }
      
      const avgBreak = Number(row[7]) || 0;
      const breaks = Number(row[9]) || 0;
      if (breaks > 0) {
        totalBreaks += breaks;
        totalBreakSpeed += avgBreak * breaks;
      }
      
      maxBreakSpeed = Math.max(maxBreakSpeed, Number(row[8]) || 0);
      totalCalibrations += Number(row[11]) || 0;
    });
    
    const recentSubmissions = rows.slice(-10).reverse().map(row => ({
      timestamp: row[0],
      anonymousId: String(row[1]).slice(0, 8) + '...',
      sessions: row[2],
      timeMin: row[3]
    }));
    
    return jsonResponse({
      totalSubmissions: rows.length,
      uniqueUsers: uniqueUsers,
      aggregateStats: {
        totalSessions: totalSessions,
        totalTimeHours: Math.round(totalTimeMin / 60 * 10) / 10,
        avgShotTime: totalShots > 0 ? Math.round(totalShotTime / totalShots * 10) / 10 : 0,
        avgBreakSpeed: totalBreaks > 0 ? Math.round(totalBreakSpeed / totalBreaks * 10) / 10 : 0,
        maxBreakSpeed: Math.round(maxBreakSpeed * 10) / 10,
        totalBreaks: totalBreaks,
        totalShots: totalShots,
        totalCalibrations: totalCalibrations
      },
      recentSubmissions: recentSubmissions
    });
    
  } catch (error) {
    return jsonResponse({ error: error.toString() });
  }
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
