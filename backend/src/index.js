const http = require('http');

const users = [];
let nextUserId = 1;
const sessions = new Map();
const projects = [];
let nextProjectId = 1;

const parseBody = (req) => new Promise((resolve, reject) => {
  let data = '';
  req.on('data', chunk => {
    data += chunk;
  });
  req.on('end', () => {
    try {
      const json = data ? JSON.parse(data) : {};
      resolve(json);
    } catch (err) {
      reject(err);
    }
  });
});

const authenticate = (req) => {
  const auth = req.headers['authorization'] || '';
  const token = auth.split(' ')[1];
  if (token && sessions.has(token)) {
    const userId = sessions.get(token);
    return users.find(u => u.id === userId) || null;
  }
  return null;
};

const send = (res, code, payload) => {
  res.writeHead(code);
  res.end(JSON.stringify(payload));
};

const requestListener = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'GET' && req.url === '/') {
    return send(res, 200, { message: 'API running' });
  }

  if (req.method === 'POST' && req.url === '/auth/register') {
    try {
      const body = await parseBody(req);
      const { username, password } = body;
      if (!username || !password) {
        return send(res, 400, { error: 'username and password required' });
      }
      if (users.some(u => u.username === username)) {
        return send(res, 409, { error: 'user exists' });
      }
      const user = { id: nextUserId++, username, password };
      users.push(user);
      return send(res, 201, { id: user.id, username: user.username });
    } catch (err) {
      return send(res, 400, { error: 'invalid json' });
    }
  }

  if (req.method === 'POST' && req.url === '/auth/login') {
    try {
      const body = await parseBody(req);
      const { username, password } = body;
      const user = users.find(u => u.username === username && u.password === password);
      if (!user) {
        return send(res, 401, { error: 'invalid credentials' });
      }
      const token = Math.random().toString(36).slice(2);
      sessions.set(token, user.id);
      return send(res, 200, { token });
    } catch (err) {
      return send(res, 400, { error: 'invalid json' });
    }
  }

  if (req.method === 'POST' && req.url === '/projects') {
    const user = authenticate(req);
    if (!user) {
      return send(res, 401, { error: 'unauthorized' });
    }
    try {
      const body = await parseBody(req);
      const { name } = body;
      if (!name) {
        return send(res, 400, { error: 'name required' });
      }
      const project = { id: nextProjectId++, name, ownerId: user.id };
      projects.push(project);
      return send(res, 201, project);
    } catch (err) {
      return send(res, 400, { error: 'invalid json' });
    }
  }

  if (req.method === 'GET' && req.url === '/projects') {
    const user = authenticate(req);
    if (!user) {
      return send(res, 401, { error: 'unauthorized' });
    }
    const userProjects = projects.filter(p => p.ownerId === user.id);
    return send(res, 200, userProjects);
  }

  return send(res, 404, { error: 'Not found' });
};

const PORT = process.env.PORT || 3000;
const server = http.createServer(requestListener);
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
