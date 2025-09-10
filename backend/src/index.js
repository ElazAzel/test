const http = require('http');

const requestListener = (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200);
    res.end(JSON.stringify({ message: 'API running' }));
  } else if (req.method === 'POST' && req.url === '/auth/register') {
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'register not implemented' }));
  } else if (req.method === 'POST' && req.url === '/auth/login') {
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'login not implemented' }));
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  }
};

const PORT = process.env.PORT || 3000;
const server = http.createServer(requestListener);
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
