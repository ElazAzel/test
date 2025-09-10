fetch('http://localhost:3000/')
  .then(r => r.json())
  .then(data => console.log('API says:', data))
  .catch(err => console.error('API error', err));
