let configs = {};

function loadMetrics_() {
  loadConfigs();

  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet;

  let sheetName = configs.sheetName.length > 1 ? configs.sheetName : `${getLongFormatDate(configs.startDate)} - ${getLongFormatDate(configs.endDate)}`;

  let existingSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (existingSheet != null) {
    sheet = existingSheet;
    existingSheet.getRange(1, 1, existingSheet.getMaxRows(), existingSheet.getMaxColumns()).clearContent().clearFormat();
    existingSheet.getCharts().forEach(chart => existingSheet.removeChart(chart))
  } else {
    sheet = spreadsheet.insertSheet()
    sheet.setName(sheetName);
  }

  // Freezes header's row
  sheet.setFrozenRows(1);

  var response = getPullRequests();
  var headers = ["Repository", "Summary", "Owner", "Ticket", "Commits", "Updates", "Needs Work", "Comments", "Fixes", "Reviewers", "ReApprovals", "Duration in hours", "Duration", "Created Date", "Closed Date", "PR Link"];

  let headersRange = sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  headersRange.setBackground('#5b95f9');
  headersRange.setFontWeight('bold');
  headersRange.setHorizontalAlignment("center");

  for (let i = 0; i < response.length; i++) {
    let pr = [response[i].repository, response[i].summary, response[i].owner, `=HYPERLINK("${configs.jiraLink}/${response[i].ticket}","${response[i].ticket}")`, response[i].commitsCount, response[i].updatesCount, response[i].needsWorkCount, response[i].commentsCount, response[i].fixesCount, response[i].reviewers, response[i].reapprovalsCount, response[i].durationInHours, response[i].duration, response[i].createdDate, response[i].closedDate, response[i].link];

    let line = i + 2;
    let range = sheet.getRange(line, 1, 1, headers.length);
    range.setValues([pr]);
    range.setHorizontalAlignment("left");
    range.setBackground(line % 2 ? '#ffffff' : '#e8f0fe');
    let rangeTicketCell = sheet.getRange(line, 4, 1, 1);
    rangeTicketCell.setFontColor('red');
    rangeTicketCell.setFontWeight('bold');
    let rangeTitleCell = sheet.getRange(line, 3, 1, 1);
    rangeTitleCell.setWrap(true);
  };

  let nextAvailableLine = response.length + 3;
  let dataRows = response.length + 1;

  createColumnChart('red', 'F', nextAvailableLine, 1, 'Updates after PR opening', sheet, dataRows);
  createColumnChart('yellow', 'K', nextAvailableLine, 3, 'Number of re-approvals', sheet, dataRows);
  createColumnChart('green', 'H', nextAvailableLine + 19, 1, 'Number of comments', sheet, dataRows);
  createColumnChart('blue', 'I', nextAvailableLine + 19, 3, 'Number of fixes', sheet, dataRows);
  createColumnChart('orange', 'L', nextAvailableLine + 38, 1, 'PR life time', sheet, dataRows);
  createColumnChart('purple', 'J', nextAvailableLine + 38, 3, 'Number of reviewers', sheet, dataRows);

  SpreadsheetApp.flush();
  for (let i = 1; i <= headers.length; i++) {
    sheet.autoResizeColumn(i);
  }

  sheet.setColumnWidth(1, 180);
  sheet.setColumnWidth(2, 450);
  SpreadsheetApp.setActiveSheet(sheet);

  var sheets = spreadsheet.getSheets();
  spreadsheet.moveActiveSheet(sheets.length);
}

/**
 * Situation Wall Metrics
 * Update each 1 hour
 * Layout only "Table"
 * Period last 30 days
 */
function loadSWMetrics() {
  loadConfigs();

  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet;

  let sheetName = "Situation Wall";

  let existingSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (existingSheet != null) {
    sheet = existingSheet;
    existingSheet.getRange(1, 1, existingSheet.getMaxRows(), existingSheet.getMaxColumns()).clearContent().clearFormat();
  } else {
    sheet = spreadsheet.insertSheet()
    sheet.setName(sheetName);
  }

  // Freezes header's row
  sheet.setFrozenRows(1);

  // Get today and last 15 days
  var today = new Date();
  var dateLimit = new Date(new Date().setDate(today.getDate() - 15));
  Logger.log(today);
  Logger.log(dateLimit);

  //var response = getPullRequests(dateLimit.getTime(), today.getTime());
  var response = getPullRequests();
  var headers = ["Repository", "Summary", "Owner", "Ticket", "Commits", "Updates", "Needs Work", "Comments", "Fixes", "Reviewers", "ReApprovals", "Duration in hours", "Duration", "Created Date", "Closed Date", "PR Link"];

  let headersRange = sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  headersRange.setBackground('#5b95f9');
  headersRange.setFontWeight('bold');
  headersRange.setHorizontalAlignment("center");

  for (let i = 0; i < response.length; i++) {
    let pr = [response[i].repository, response[i].summary, response[i].owner, `=HYPERLINK("${configs.jiraLink}/${response[i].ticket}","${response[i].ticket}")`, response[i].commitsCount, response[i].updatesCount, response[i].needsWorkCount, response[i].commentsCount, response[i].fixesCount, response[i].reviewers, response[i].reapprovalsCount, response[i].durationInHours, response[i].duration, response[i].createdDate, response[i].closedDate, response[i].link];

    let line = i + 2;
    let range = sheet.getRange(line, 1, 1, headers.length);
    range.setValues([pr]);
    range.setHorizontalAlignment("left");
    range.setBackground(line % 2 ? '#ffffff' : '#e8f0fe');
    let rangeTicketCell = sheet.getRange(line, 4, 1, 1);
    rangeTicketCell.setFontColor('red');
    rangeTicketCell.setFontWeight('bold');
    let rangeTitleCell = sheet.getRange(line, 3, 1, 1);
    rangeTitleCell.setWrap(true);
  };

  sheet.setColumnWidth(1, 180);
  sheet.setColumnWidth(2, 450);
  SpreadsheetApp.setActiveSheet(sheet);

  var sheets = spreadsheet.getSheets();
  spreadsheet.moveActiveSheet(sheets.length);
}

function getPullRequests(startDate = null, endDate = null) {
  Logger.log(configs.startDate.getTime());
  Logger.log(configs.endDate.getTime());
  var options = {
    'method': 'post',
    'contentType': 'application/json',
    // Convert the JavaScript object to a JSON string.
    'payload': JSON.stringify({
      "startDate": !startDate ? configs.startDate.getTime() : startDate,
      "endDate": !endDate ? configs.endDate.getTime() : endDate,
      "branchName": configs.branchName,
      "project": configs.project,
      "repositories": configs.repositories,
      "bitBucketKey": configs.bitBucketKey
    }),
    'headers': {
      "x-api-key": configs.apiKey
    }
  };

  var res = UrlFetchApp.fetch("https://LAMBDA-URL_TO_GET_BITBUCKET_PR_METRICS", options);
  var json = JSON.parse(res.getContentText());
  return json.pullRequests;
}

function createColumnChart(color, dataColumn, row, column, title, sheet, dataRows) {
  var rangeChart = sheet.getRange(dataColumn + '2:' + dataColumn + dataRows);
  var rangeTickets = sheet.getRange('D2:D' + dataRows);

  var chartBuilder = sheet.newChart();
  var chart = chartBuilder
    .addRange(rangeTickets)
    .addRange(rangeChart)
    .setPosition(row, column, 1, 1)
    .setChartType(Charts.ChartType.COLUMN)
    .setOption('title', title)
    .setOption('colors', [color])
    .build();
  sheet.insertChart(chart);
}

function loadConfigs() {
  var settingsSheet =
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Settings");

  configs.startDate = new Date(getCellValue(settingsSheet, "B2"));
  configs.endDate = new Date(getCellValue(settingsSheet, "B3"));
  configs.sheetName = getCellValue(settingsSheet, "B4");
  configs.jiraLink = getCellValue(settingsSheet, "B9");
  configs.project = getCellValue(settingsSheet, "B8");
  configs.branchName = getCellValue(settingsSheet, "B10");
  configs.repositories = getCellValue(settingsSheet, "B11").split(',');
  configs.apiKey = getCellValue(settingsSheet, "B12");
  configs.bitBucketKey = getCellValue(settingsSheet, "B13");
}

function getCellValue(sheet, pos) {
  return sheet.getRange(pos).getValue()
}

let getLongFormatDate = (date) =>
  date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    timeZone: 'UTC'
  });