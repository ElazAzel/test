const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pm-backend-'));
process.env.DATA_FILE = path.join(tempDir, 'data.json');
process.env.TOKEN_TTL_MS = '75';

const handler = require('../src/index.js');

const startServer = () => new Promise((resolve, reject) => {
  const server = http.createServer(handler);
  server.listen(0, () => {
    const address = server.address();
    if (!address || typeof address.port !== 'number') {
      server.close();
      reject(new Error('Failed to determine server port'));
      return;
    }
    resolve({ server, port: address.port });
  });
  server.on('error', reject);
});

const stopServer = (server) => new Promise((resolve) => {
  server.close(() => resolve());
});

const requestJson = (port, { method = 'GET', path: requestPath, body, token }) => new Promise((resolve, reject) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const payload = body ? JSON.stringify(body) : undefined;
  const req = http.request(
    {
      port,
      method,
      path: requestPath,
      headers,
    },
    (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        raw += chunk;
      });
      res.on('end', () => {
        try {
          const result = raw ? JSON.parse(raw) : null;
          resolve({ statusCode: res.statusCode, body: result });
        } catch (err) {
          reject(err);
        }
      });
    }
  );

  req.on('error', reject);
  if (payload) {
    req.write(payload);
  }
  req.end();
});

test('root endpoint responds with API status', async () => {
  const { server, port } = await startServer();
  try {
    const response = await requestJson(port, { path: '/' });
    assert.strictEqual(response.statusCode, 200);
    assert.deepStrictEqual(response.body, { message: 'API running' });
  } finally {
    await stopServer(server);
  }
});

test('registration hashes passwords and login returns expiring token', async () => {
  const { server, port } = await startServer();
  try {
    const username = `user_${Date.now()}`;
    const register = await requestJson(port, {
      method: 'POST',
      path: '/auth/register',
      body: { username, password: 'securePass1' },
    });
    assert.strictEqual(register.statusCode, 201);

    const stored = JSON.parse(fs.readFileSync(process.env.DATA_FILE, 'utf8'));
    const savedUser = stored.users.find((u) => u.username === username);
    assert.ok(savedUser, 'user should be persisted');
    assert.ok(savedUser.passwordHash, 'password hash should be stored');
    assert.ok(savedUser.passwordSalt, 'password salt should be stored');
    assert.strictEqual(savedUser.password, undefined, 'plain password should be removed');

    const login = await requestJson(port, {
      method: 'POST',
      path: '/auth/login',
      body: { username, password: 'securePass1' },
    });
    assert.strictEqual(login.statusCode, 200);
    assert.ok(login.body.token, 'token should be returned');
    assert.ok(login.body.expiresAt, 'token expiry should be returned');
  } finally {
    await stopServer(server);
  }
});

test('expired tokens are rejected', async () => {
  const { server, port } = await startServer();
  try {
    const username = `user_${Date.now()}_exp`;
    const password = 'securePass2';
    const register = await requestJson(port, {
      method: 'POST',
      path: '/auth/register',
      body: { username, password },
    });
    assert.strictEqual(register.statusCode, 201);

    const login = await requestJson(port, {
      method: 'POST',
      path: '/auth/login',
      body: { username, password },
    });
    assert.strictEqual(login.statusCode, 200);
    const token = login.body.token;
    assert.ok(token);

    await new Promise((resolve) => setTimeout(resolve, 120));

    const projectsResponse = await requestJson(port, {
      method: 'GET',
      path: '/projects',
      token,
    });
    assert.strictEqual(projectsResponse.statusCode, 401);
    assert.deepStrictEqual(projectsResponse.body, { error: 'unauthorized' });
  } finally {
    await stopServer(server);
  }
});
