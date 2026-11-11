const { execSync } = require('child_process');
const fs = require('fs');

// We can run a headless chrome that opens http://localhost:3000, then after a delay takes a screenshot!
// In modern Chrome:
// chrome --headless=new --screenshot=... --window-size=1280,820 url
// But to allow JS to run for 2 seconds, we can tell chrome to use a script or use setTimeout!
// Even simpler: let's test if active tab page-synthesizer works!
console.log('Testing screenshot capture with delay...');
