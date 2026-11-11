const http = require('http');

http.get('http://localhost:3000', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('HTML length:', data.length);
    console.log('Includes config:', data.includes('id="page-config"'));
  });
});
