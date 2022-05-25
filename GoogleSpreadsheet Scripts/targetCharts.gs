function targetCharts_() {
  var activeSheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var chartsSheet =
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Charts");

  targetChart(chartsSheet.getCharts()[0], activeSheet, chartsSheet, 'K2:K2000', 'PR life time');
  targetChart(chartsSheet.getCharts()[1], activeSheet, chartsSheet, 'G2:G2000', 'Number of comments');
  targetChart(chartsSheet.getCharts()[2], activeSheet, chartsSheet, 'I2:I2000', 'Number of reviewers');
  targetChart(chartsSheet.getCharts()[3], activeSheet, chartsSheet, 'E2:E2000', 'Updates after PR opening');
  targetChart(chartsSheet.getCharts()[4], activeSheet, chartsSheet, 'J2:J2000', 'Number of re-approvals');
}

function targetChart(chart, activeSheet, chartsSheet, range, title) {
  var rangeChart = activeSheet.getRange(range);
  var rangeTickets = activeSheet.getRange('C2:C2000');

  chart = chart.modify()
    .clearRanges()
    .addRange(rangeTickets)
    .addRange(rangeChart)
    .setOption('title', title)
    .build();

  chartsSheet.updateChart(chart);
}