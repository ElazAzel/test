fetch('/api')
  .then(r => r.json())
  .then(data => console.log('API says:', data))
  .catch(err => console.error('API error', err));

const token = localStorage.getItem('token');
if (token) {
  fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
    .then(r => r.json())
    .then(data => console.log('Logged in as:', data))
    .catch(err => console.error('Auth error', err));
}
