let token = localStorage.getItem('token');
let currentProjectId = null;

const authSection = document.getElementById('auth');
const appSection = document.getElementById('app');
const projectDetail = document.getElementById('projectDetail');
const projectTitle = document.getElementById('projectTitle');
const projectListEl = document.getElementById('projectList');
const taskListEl = document.getElementById('taskList');

function setToken(newToken) {
  token = newToken;
  if (token) localStorage.setItem('token', token);
  else localStorage.removeItem('token');
}

function updateUI() {
  if (token) {
    authSection.style.display = 'none';
    appSection.style.display = 'block';
    loadProjects();
  } else {
    authSection.style.display = 'block';
    appSection.style.display = 'none';
    projectDetail.style.display = 'none';
  }
}

document.getElementById('registerForm').addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.target;
  await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: form.username.value, password: form.password.value })
  });
  form.reset();
  alert('Registered! Now log in.');
});

document.getElementById('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.target;
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: form.username.value, password: form.password.value })
  });
  if (res.ok) {
    const data = await res.json();
    setToken(data.token);
    updateUI();
  } else {
    alert('Login failed');
  }
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  setToken(null);
  updateUI();
});

async function loadProjects() {
  const res = await fetch('/api/projects', { headers: { Authorization: `Bearer ${token}` } });
  const projects = await res.json();
  projectListEl.innerHTML = '';
  projects.forEach(p => {
    const li = document.createElement('li');
    li.textContent = p.name;
    li.addEventListener('click', () => selectProject(p));
    projectListEl.appendChild(li);
  });
}

document.getElementById('projectForm').addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.target;
  await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: form.name.value })
  });
  form.reset();
  loadProjects();
});

function selectProject(project) {
  currentProjectId = project.id;
  projectTitle.textContent = project.name;
  projectDetail.style.display = 'block';
  loadTasks();
}

async function loadTasks() {
  const res = await fetch(`/api/projects/${currentProjectId}/tasks`, { headers: { Authorization: `Bearer ${token}` } });
  const tasks = await res.json();
  taskListEl.innerHTML = '';
  tasks.forEach(t => {
    const li = document.createElement('li');
    li.textContent = t.title + (t.dueDate ? ` (${t.dueDate})` : '') + (t.completed ? ' \u2714' : '');
    taskListEl.appendChild(li);
  });
}

document.getElementById('taskForm').addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.target;
  await fetch(`/api/projects/${currentProjectId}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ title: form.title.value, dueDate: form.dueDate.value || undefined })
  });
  form.reset();
  loadTasks();
});

fetch('/api')
  .then(r => r.json())
  .then(data => console.log('API says:', data))
  .catch(err => console.error('API error', err));

// Render the appropriate section immediately
updateUI();

// Verify any stored token without blocking the initial render
if (token) {
  fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
    .then(r => {
      if (!r.ok) throw new Error();
      return r.json();
    })
    .then(data => console.log('Logged in as:', data))
    .catch(() => {
      setToken(null);
      updateUI();
    });
}
