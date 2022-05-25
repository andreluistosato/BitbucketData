function onOpen() {
  var spreadsheet = SpreadsheetApp.getActive();
  var menuItems = [
    { name: 'Load code review metrics', functionName: 'loadMetrics_' },
    { name: 'Update Situation Wall', functionName: 'loadSWMetrics' }
    //{ name: 'Target charts to current sheet', functionName: 'targetCharts_' }
  ];
  spreadsheet.addMenu('CR Metrics', menuItems);
}

function onEdit(e) {
  // Getting the "Jira Issue" sheet
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Updated Date");
  
  var rowRange = sheet.getRange(2,1);
  var lastUpdatedDate = Utilities.formatDate(new Date(),"GMT-4","yyyy-MM-dd hh:mm:ss");
  rowRange.setValue(lastUpdatedDate);
}