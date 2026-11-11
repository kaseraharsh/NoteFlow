const { execSync } = require('child_process');
const output = execSync('"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --headless --disable-gpu --dump-dom "http://localhost:3000/#page-config"', { encoding: 'utf-8' });

const configStart = output.indexOf('id="page-config"');
if (configStart !== -1) {
  console.log(output.substring(configStart - 20, configStart + 300));
} else {
  console.log('Not found');
}
