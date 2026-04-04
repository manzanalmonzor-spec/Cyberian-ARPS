const fs = require('fs');
const path = require('path');

const files = [
  'admin/js/centers.js','admin/js/weather.js','firebase-config.js','functions/index.js',
  'runtime-config.js','test-sms.js','user/js/evacuation-page.js','user/js/gps-page.js',
  'user/js/map-common.js','admin/js/auth-guard.js','admin/js/admin-mobile.js',
  'user/js/sos.js','user/js/ban-guard.js','service-worker.js','admin/js/sos-sound.js',
  'admin/js/settings.js','admin/js/alerts.js','admin/js/dashboard.js','user/js/auth-guard.js',
  'shared.js','admin/js/map.js',
  'admin/css/alerts.css','admin/css/centers.css','admin/css/dashboard.css',
  'admin/css/settings.css','admin/css/weather.css','shared.css',
  'admin/css/admin-mobile.css','admin/css/map.css',
  'api/send-sms.mjs','api/groq-chat.mjs'
];

files.forEach(function(f) {
  var fp = path.join('.', f);
  if (!fs.existsSync(fp)) return;
  var content = fs.readFileSync(fp, 'utf8');
  var before = content.length;
  
  var result = '';
  var i = 0;
  while (i < content.length) {
    var ch = content[i];
    // Handle string literals
    if (ch === '"' || ch === "'" || ch === '`') {
      var quote = ch;
      result += content[i++];
      while (i < content.length && content[i] !== quote) {
        if (content[i] === '\') {
          result += content[i++];
          if (i < content.length) result += content[i++];
        } else {
          result += content[i++];
        }
      }
      if (i < content.length) result += content[i++];
      continue;
    }
    // Block comments
    if (ch === '/' && i + 1 < content.length && content[i+1] === '*') {
      var end = content.indexOf('*/', i + 2);
      if (end !== -1) { i = end + 2; continue; }
    }
    // Single-line comments but not URLs
    if (ch === '/' && i + 1 < content.length && content[i+1] === '/') {
      if (i > 0 && content[i-1] === ':') {
        result += content[i++];
        continue;
      }
      while (i < content.length && content[i] !== '\n') i++;
      continue;
    }
    result += content[i++];
  }
  
  // Clean up excessive blank lines
  result = result.replace(/\n{3,}/g, '\n\n');
  // Remove trailing whitespace on lines
  result = result.replace(/[ \t]+\n/g, '\n');
  
  var removed = before - result.length;
  if (removed > 0) {
    fs.writeFileSync(fp, result, 'utf8');
    console.log(f + ': removed ' + removed + ' chars');
  }
});
