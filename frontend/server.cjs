const http = require('http');
const fs = require('fs');
const path = require('path');

const serveFile = (res, filePath, type) => {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end('Not found');
    }
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  });
};

const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    return serveFile(res, path.join(__dirname, 'index.html'), 'text/html');
  }
  if (req.url === '/src/main.js') {
    return serveFile(res, path.join(__dirname, 'src', 'main.js'), 'application/javascript');
  }
  res.writeHead(404);
  res.end('Not found');
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Frontend running on http://localhost:${PORT}`);
});

module.exports = server;
