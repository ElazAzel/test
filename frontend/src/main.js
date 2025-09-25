let token = localStorage.getItem('token');
const storedExpiry = localStorage.getItem('tokenExpiresAt');
if (token && storedExpiry) {
  const expiry = Number(storedExpiry);
  if (!Number.isFinite(expiry) || expiry <= Date.now()) {
    localStorage.removeItem('token');
    localStorage.removeItem('tokenExpiresAt');
    token = null;
  }
}
let currentProjectId = null;

// Determine API base for local development vs. Vercel deployment.
// When served from the static frontend on port 8080, point to the
// separately running backend on port 3000. In production the backend is
// available under the same origin at the `/api` prefix.
const API_BASE = location.origin.includes('localhost:8080') ?
  'http://localhost:3000' : '/api';

const authSection = document.getElementById('auth');
const appSection = document.getElementById('app');
const projectDetail = document.getElementById('projectDetail');
const projectTitle = document.getElementById('projectTitle');
const projectListEl = document.getElementById('projectList');
const taskListEl = document.getElementById('taskList');
const apiStatusEl = document.getElementById('apiStatus');

const setApiStatus = (message) => {
  if (apiStatusEl) {
    apiStatusEl.textContent = message;
  }
};

function setToken(newToken, expiresAt) {
  token = newToken;
  if (token) {
    localStorage.setItem('token', token);
    if (expiresAt) {
      localStorage.setItem('tokenExpiresAt', String(expiresAt));
    } else {
      localStorage.removeItem('tokenExpiresAt');
    }
  } else {
    localStorage.removeItem('token');
    localStorage.removeItem('tokenExpiresAt');
  }
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
  if (form.password.value.length < 8) {
    alert('Password must be at least 8 characters long.');
    return;
  }
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: form.username.value, password: form.password.value })
  });
  if (res.ok) {
    form.reset();
    alert('Registered! Now log in.');
  } else {
    const error = await res.json().catch(() => ({}));
    alert(error.error || 'Registration failed');
  }
});

document.getElementById('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.target;
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: form.username.value, password: form.password.value })
  });
  if (res.ok) {
    const data = await res.json();
    setToken(data.token, data.expiresAt);
    updateUI();
  } else {
    const error = await res.json().catch(() => ({}));
    alert(error.error || 'Login failed');
  }
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await fetch(`${API_BASE}/auth/logout`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  setToken(null);
  updateUI();
});

async function loadProjects() {
  const res = await fetch(`${API_BASE}/projects`, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401) {
    setToken(null);
    updateUI();
    return;
  }
  if (!res.ok) {
    alert('Failed to load projects');
    return;
  }
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
  const res = await fetch(`${API_BASE}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: form.name.value })
  });
  if (res.status === 401) {
    setToken(null);
    updateUI();
    return;
  }
  if (!res.ok) {
    alert('Failed to create project');
    return;
  }
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
  const res = await fetch(`${API_BASE}/projects/${currentProjectId}/tasks`, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401) {
    setToken(null);
    updateUI();
    return;
  }
  if (!res.ok) {
    alert('Failed to load tasks');
    return;
  }
  const tasks = await res.json();
  taskListEl.innerHTML = '';
  tasks.forEach(t => {
    const li = document.createElement('li');

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = t.completed;
    checkbox.addEventListener('change', async () => {
      await fetch(`${API_BASE}/projects/${currentProjectId}/tasks/${t.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ completed: checkbox.checked })
      });
      loadTasks();
    });
    li.appendChild(checkbox);

    const span = document.createElement('span');
    span.textContent = `${t.title} [${t.priority}]` + (t.dueDate ? ` (${t.dueDate})` : '');
    if (t.completed) span.style.textDecoration = 'line-through';
    li.appendChild(span);

    const delBtn = document.createElement('button');
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', async () => {
      await fetch(`${API_BASE}/projects/${currentProjectId}/tasks/${t.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      loadTasks();
    });
    li.appendChild(delBtn);

    taskListEl.appendChild(li);
  });
}

document.getElementById('taskForm').addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.target;
  const res = await fetch(`${API_BASE}/projects/${currentProjectId}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      title: form.title.value,
      dueDate: form.dueDate.value || undefined,
      priority: form.priority.value
    })
  });
  if (res.status === 401) {
    setToken(null);
    updateUI();
    return;
  }
  if (!res.ok) {
    alert('Failed to create task');
    return;
  }
  form.reset();
  loadTasks();
});

fetch(API_BASE)
  .then(async (response) => {
    const contentType = response.headers.get('content-type') || '';
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }
    if (contentType.includes('application/json')) {
      const data = await response.json();
      const message = data && typeof data === 'object' && 'message' in data
        ? data.message
        : JSON.stringify(data);
      setApiStatus(`API status: ${message}`);
      console.log('API says:', message);
      return;
    }
    const text = await response.text();
    const message = text || 'No status available';
    setApiStatus(`API status: ${message}`);
    console.log('API says:', message);
  })
  .catch(err => {
    setApiStatus('API status: offline');
    console.error('API error', err);
  });

// Render the appropriate section immediately
updateUI();

// Verify any stored token without blocking the initial render
if (token) {
  fetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
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
