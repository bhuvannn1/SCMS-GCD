const fs = require('fs');
let file = fs.readFileSync('d:/SCMS-GCD/scms/src/pages/AnalyticsPage.jsx', 'utf8');

// Fix escaped backticks and escaped dollar signs
file = file.replaceAll('\\`', '`');
file = file.replaceAll('\\$', '$');

fs.writeFileSync('d:/SCMS-GCD/scms/src/pages/AnalyticsPage.jsx', file);
console.log("Fixed with replaceAll!");
