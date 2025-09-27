import test from 'node:test';
import assert from 'node:assert';
import http from 'node:http';

// Ensure frontend serves index with embedded favicon and returns 200

test('serves index with inline favicon', async (t) => {
  const server = (await import('../server.cjs')).default;
  t.after(() => server.close());

  const res = await new Promise((resolve, reject) => {
    http
      .get('http://localhost:8080/', (r) => {
        let body = '';
        r.setEncoding('utf8');
        r.on('data', (chunk) => (body += chunk));
        r.on('end', () => resolve({ status: r.statusCode, body }));
      })
      .on('error', reject);
  });

  assert.equal(res.status, 200);
  assert.ok(res.body.includes('data:image/png;base64'));
});
