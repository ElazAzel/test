const API_BASE = location.origin.includes('localhost:8080') ? 'http://localhost:3000' : '/api';

const dom = {
  apiStatus: document.getElementById('apiStatus'),
  auth: document.getElementById('auth'),
  app: document.getElementById('app'),
  registerForm: document.getElementById('registerForm'),
  loginForm: document.getElementById('loginForm'),
  logoutBtn: document.getElementById('logoutBtn'),
  projectForm: document.getElementById('projectForm'),
  refreshProjectsBtn: document.getElementById('refreshProjectsBtn'),
  projectList: document.getElementById('projectList'),
  currentUserName: document.getElementById('currentUserName'),
  memberCard: document.getElementById('memberCard'),
  memberList: document.getElementById('memberList'),
  memberForm: document.getElementById('memberForm'),
  projectRoleLabel: document.getElementById('projectRoleLabel'),
  workspaceTitle: document.getElementById('workspaceTitle'),
  workspaceMeta: document.getElementById('workspaceMeta'),
  projectActions: document.getElementById('projectActions'),
  renameProjectBtn: document.getElementById('renameProjectBtn'),
  deleteProjectBtn: document.getElementById('deleteProjectBtn'),
  boardArea: document.getElementById('boardArea'),
  emptyState: document.getElementById('emptyState'),
  taskForm: document.getElementById('taskForm'),
  taskSummary: document.getElementById('taskSummary'),
  taskCreateStatusSelect: document.getElementById('taskCreateStatusSelect'),
  kanbanBoard: document.getElementById('kanbanBoard'),
  statusList: document.getElementById('statusList'),
  statusForm: document.getElementById('statusForm'),
  taskDrawer: document.getElementById('taskDrawer'),
  taskDrawerTitle: document.getElementById('taskDrawerTitle'),
  closeTaskDrawer: document.getElementById('closeTaskDrawer'),
  taskEditForm: document.getElementById('taskEditForm'),
  taskDetailTitle: document.getElementById('taskDetailTitle'),
  taskDetailStatus: document.getElementById('taskDetailStatus'),
  taskDetailPriority: document.getElementById('taskDetailPriority'),
  taskDetailDueDate: document.getElementById('taskDetailDueDate'),
  taskDetailCompleted: document.getElementById('taskDetailCompleted'),
  taskDeleteBtn: document.getElementById('taskDeleteBtn'),
  subtaskList: document.getElementById('subtaskList'),
  subtaskForm: document.getElementById('subtaskForm'),
  commentList: document.getElementById('commentList'),
  commentForm: document.getElementById('commentForm'),
  commentText: document.getElementById('commentText'),
  toast: document.getElementById('toast'),
};

const state = {
  token: null,
  tokenExpiresAt: null,
  user: null,
  projects: [],
  currentProjectId: null,
  statuses: [],
  tasks: [],
  members: [],
  taskMeta: {},
  taskDetailsCache: new Map(),
  isOwner: false,
};

function loadPersistedToken() {
  const storedToken = localStorage.getItem('token');
  const storedExpiry = localStorage.getItem('tokenExpiresAt');
  if (!storedToken) {
    return;
  }
  if (storedExpiry) {
    const expiry = Number(storedExpiry);
    if (Number.isFinite(expiry) && expiry > Date.now()) {
      state.token = storedToken;
      state.tokenExpiresAt = expiry;
    } else {
      localStorage.removeItem('token');
      localStorage.removeItem('tokenExpiresAt');
    }
  } else {
    state.token = storedToken;
  }
}

function setToken(token, expiresAt) {
  state.token = token;
  state.tokenExpiresAt = expiresAt || null;
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

function setApiStatus(message, variant = 'info') {
  if (!dom.apiStatus) return;
  dom.apiStatus.textContent = message;
  dom.apiStatus.removeAttribute('data-state');
  if (variant === 'online') {
    dom.apiStatus.dataset.state = 'online';
  } else if (variant === 'error') {
    dom.apiStatus.dataset.state = 'error';
  }
}

let toastTimeout;
function showToast(message, variant = 'info') {
  if (!dom.toast) return;
  dom.toast.textContent = message;
  dom.toast.dataset.variant = variant;
  dom.toast.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    dom.toast.classList.remove('show');
  }, 4000);
}

function hideToast() {
  if (dom.toast) {
    dom.toast.classList.remove('show');
  }
}

function handleUnauthorized() {
  setToken(null);
  state.user = null;
  state.projects = [];
  state.currentProjectId = null;
  state.statuses = [];
  state.tasks = [];
  state.members = [];
  state.taskMeta = {};
  state.taskDetailsCache.clear();
  if (dom.currentUserName) {
    dom.currentUserName.textContent = '—';
  }
  updateAuthVisibility();
  renderWorkspace();
  renderProjects();
  renderMemberSection();
  renderStatusManager();
  renderBoard();
}

async function callApi(path, options = {}) {
  const opts = { method: 'GET', ...options };
  opts.headers = new Headers(opts.headers || {});
  if (state.token) {
    opts.headers.set('Authorization', `Bearer ${state.token}`);
  }

  if (opts.body && !(opts.body instanceof FormData)) {
    opts.headers.set('Content-Type', 'application/json');
    opts.body = JSON.stringify(opts.body);
  }

  const response = await fetch(`${API_BASE}${path}`, opts).catch(err => {
    throw new Error(err.message || 'Network error');
  });

  if (response.status === 401) {
    handleUnauthorized();
    throw new Error('Authentication required');
  }

  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch (err) {
      payload = text;
    }
  }

  if (!response.ok) {
    const message = payload && typeof payload === 'object' && payload.error ? payload.error : response.statusText;
    throw new Error(message || 'Request failed');
  }

  return payload;
}

function updateAuthVisibility() {
  if (!dom.auth || !dom.app) return;
  if (state.token) {
    dom.auth.hidden = true;
    dom.app.hidden = false;
  } else {
    dom.auth.hidden = false;
    dom.app.hidden = true;
  }
}

async function checkApiHealth() {
  try {
    const status = await fetch(`${API_BASE}/`).then(res => res.json());
    const message = status && status.message ? status.message : 'API reachable';
    setApiStatus(`API status: ${message}`, 'online');
  } catch (err) {
    setApiStatus('API unreachable. Start the backend to continue.', 'error');
  }
}

async function resumeSession() {
  if (!state.token) return;
  try {
    const user = await callApi('/auth/me');
    state.user = user;
    updateAuthVisibility();
    dom.currentUserName.textContent = user.username;
    await loadProjects();
  } catch (err) {
    showToast(err.message, 'error');
    handleUnauthorized();
  }
}

async function loadProjects() {
  if (!state.token) return;
  try {
    const projects = await callApi('/projects');
    state.projects = Array.isArray(projects) ? projects : [];
    if (state.currentProjectId) {
      const stillExists = state.projects.some(p => p.id === state.currentProjectId);
      if (!stillExists) {
        state.currentProjectId = null;
      }
    }
    renderProjects();
    if (state.currentProjectId) {
      await loadProjectContext(state.currentProjectId);
    } else if (state.projects.length) {
      await loadProjectContext(state.projects[0].id);
    } else {
      renderWorkspace();
      renderMemberSection();
      renderStatusManager();
      renderBoard();
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderProjects() {
  if (!dom.projectList) return;
  dom.projectList.innerHTML = '';
  if (!state.projects.length) {
    const empty = document.createElement('li');
    empty.textContent = 'No projects yet. Create one to get started.';
    empty.style.color = 'var(--text-secondary)';
    dom.projectList.appendChild(empty);
    return;
  }

  state.projects.forEach(project => {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.className = 'project-pill';
    button.type = 'button';
    button.dataset.id = project.id;
    if (project.id === state.currentProjectId) {
      button.setAttribute('aria-current', 'true');
    }

    const info = document.createElement('div');
    info.style.display = 'flex';
    info.style.flexDirection = 'column';
    info.style.gap = '0.2rem';

    const nameEl = document.createElement('strong');
    nameEl.textContent = project.name;
    info.appendChild(nameEl);

    const meta = document.createElement('span');
    meta.className = 'project-pill__meta';
    const memberCount = Array.isArray(project.members) ? project.members.length : 1;
    const statusCount = state.currentProjectId === project.id ? state.statuses.length : 0;
    meta.textContent = `${memberCount} member${memberCount === 1 ? '' : 's'}${statusCount ? ` • ${statusCount} statuses` : ''}`;
    info.appendChild(meta);

    button.appendChild(info);

    const isOwner = state.user && project.ownerId === state.user.id;
    if (isOwner) {
      const badge = document.createElement('span');
      badge.className = 'badge owner';
      badge.textContent = 'Admin';
      button.appendChild(badge);
    }

    button.addEventListener('click', () => {
      if (state.currentProjectId !== project.id) {
        loadProjectContext(project.id);
      }
    });

    li.appendChild(button);
    dom.projectList.appendChild(li);
  });
}

function getCurrentProject() {
  if (!state.currentProjectId) return null;
  return state.projects.find(p => p.id === state.currentProjectId) || null;
}

async function loadProjectContext(projectId) {
  state.currentProjectId = projectId;
  state.taskDetailsCache.clear();
  state.taskMeta = {};
  renderProjects();
  const project = getCurrentProject();
  if (!project) {
    renderWorkspace();
    renderMemberSection();
    renderStatusManager();
    renderBoard();
    return;
  }

  try {
    const [statuses, tasks, members] = await Promise.all([
      callApi(`/projects/${projectId}/statuses`),
      callApi(`/projects/${projectId}/tasks`),
      callApi(`/projects/${projectId}/members`),
    ]);

    state.statuses = Array.isArray(statuses) ? statuses.sort((a, b) => a.id - b.id) : [];
    state.tasks = Array.isArray(tasks) ? tasks : [];
    state.members = Array.isArray(members) ? members : [];
    state.isOwner = state.user ? project.ownerId === state.user.id : false;

    renderWorkspace();
    renderMemberSection();
    renderStatusManager();
    renderBoard();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderWorkspace() {
  const project = getCurrentProject();
  if (!project) {
    dom.workspaceTitle.textContent = 'Plan unforgettable events';
    dom.workspaceMeta.textContent = 'Create a project to unlock kanban boards, subtasks, comments, and collaboration tools.';
    dom.projectActions.hidden = true;
    dom.boardArea.hidden = true;
    dom.emptyState.hidden = false;
    dom.taskSummary.textContent = 'No tasks yet';
    return;
  }

  dom.workspaceTitle.textContent = project.name;
  const taskCount = state.tasks.length;
  const completedCount = state.tasks.filter(task => task.completed).length;
  dom.workspaceMeta.textContent = `${taskCount} task${taskCount === 1 ? '' : 's'} • ${completedCount} completed`; 
  dom.projectActions.hidden = !state.isOwner;
  dom.boardArea.hidden = false;
  dom.emptyState.hidden = true;
  updateTaskSummary();
}

function renderMemberSection() {
  const project = getCurrentProject();
  if (!project) {
    dom.memberCard.hidden = true;
    return;
  }
  dom.memberCard.hidden = false;
  dom.memberList.innerHTML = '';
  const role = state.isOwner ? 'Administrator' : 'Member';
  if (role && dom.projectRoleLabel) {
    dom.projectRoleLabel.hidden = false;
    dom.projectRoleLabel.textContent = role;
    dom.projectRoleLabel.classList.toggle('owner', state.isOwner);
  }

  state.members.forEach(member => {
    const li = document.createElement('li');
    li.className = 'member-item';
    const name = document.createElement('span');
    name.textContent = member.username;
    li.appendChild(name);

    if (project.ownerId === member.id) {
      const badge = document.createElement('span');
      badge.className = 'badge owner';
      badge.textContent = 'Owner';
      li.appendChild(badge);
    } else if (state.isOwner) {
      const removeBtn = document.createElement('button');
      removeBtn.className = 'ghost danger';
      removeBtn.type = 'button';
      removeBtn.textContent = 'Remove';
      removeBtn.addEventListener('click', async () => {
        if (!confirm(`Remove ${member.username} from this project?`)) return;
        try {
          await callApi(`/projects/${project.id}/members/${member.id}`, { method: 'DELETE' });
          showToast('Member removed', 'success');
          await loadProjectContext(project.id);
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
      li.appendChild(removeBtn);
    }

    dom.memberList.appendChild(li);
  });

  if (state.isOwner) {
    dom.memberForm.hidden = false;
  } else {
    dom.memberForm.hidden = true;
  }
}

function renderStatusManager() {
  dom.statusList.innerHTML = '';
  const project = getCurrentProject();
  if (!project) {
    dom.statusForm.hidden = true;
    return;
  }

  state.statuses.forEach(status => {
    const li = document.createElement('li');
    li.className = 'status-item';
    const name = document.createElement('span');
    name.textContent = status.name;
    li.appendChild(name);

    if (state.isOwner) {
      const actions = document.createElement('div');
      actions.className = 'status-actions';

      const renameBtn = document.createElement('button');
      renameBtn.type = 'button';
      renameBtn.className = 'ghost';
      renameBtn.textContent = 'Rename';
      renameBtn.addEventListener('click', async () => {
        const newName = prompt('Status name', status.name);
        if (!newName || newName.trim() === status.name) return;
        try {
          const updated = await callApi(`/projects/${project.id}/statuses/${status.id}`, {
            method: 'PATCH',
            body: { name: newName.trim() },
          });
          const index = state.statuses.findIndex(s => s.id === status.id);
          if (index !== -1) {
            state.statuses[index] = updated;
          }
          renderStatusManager();
          renderBoard();
          showToast('Status renamed', 'success');
        } catch (err) {
          showToast(err.message, 'error');
        }
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'ghost danger';
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', async () => {
        if (!confirm(`Delete status “${status.name}”? Tasks will move to the first available column.`)) return;
        try {
          await callApi(`/projects/${project.id}/statuses/${status.id}`, { method: 'DELETE' });
          state.statuses = state.statuses.filter(s => s.id !== status.id);
          renderStatusManager();
          await loadProjectContext(project.id);
          showToast('Status removed', 'success');
        } catch (err) {
          showToast(err.message, 'error');
        }
      });

      actions.appendChild(renameBtn);
      actions.appendChild(deleteBtn);
      li.appendChild(actions);
    }

    dom.statusList.appendChild(li);
  });

  dom.statusForm.hidden = !state.isOwner;
  updateTaskStatusOptions();
}

function updateTaskStatusOptions() {
  if (!dom.taskCreateStatusSelect || !dom.taskDetailStatus) return;
  dom.taskCreateStatusSelect.innerHTML = '';
  dom.taskDetailStatus.innerHTML = '';
  if (!state.statuses.length) {
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'No statuses available';
    dom.taskCreateStatusSelect.appendChild(placeholder.cloneNode(true));
    dom.taskDetailStatus.appendChild(placeholder);
    dom.taskCreateStatusSelect.disabled = true;
    dom.taskDetailStatus.disabled = true;
    return;
  }
  dom.taskCreateStatusSelect.disabled = false;
  dom.taskDetailStatus.disabled = false;
  state.statuses.forEach(status => {
    const option = document.createElement('option');
    option.value = status.id;
    option.textContent = status.name;
    dom.taskCreateStatusSelect.appendChild(option.cloneNode(true));
    dom.taskDetailStatus.appendChild(option);
  });
}

function updateTaskSummary() {
  const total = state.tasks.length;
  const completed = state.tasks.filter(task => task.completed).length;
  if (!total) {
    dom.taskSummary.textContent = 'No tasks yet';
  } else {
    dom.taskSummary.textContent = `${total} task${total === 1 ? '' : 's'} • ${completed} completed`;
  }
}

function renderBoard() {
  dom.kanbanBoard.innerHTML = '';
  const project = getCurrentProject();
  if (!project) {
    return;
  }

  const tasksByStatus = new Map();
  state.statuses.forEach(status => {
    tasksByStatus.set(status.id, []);
  });
  const backlog = [];

  state.tasks.forEach(task => {
    const statusId = typeof task.statusId === 'number' ? task.statusId : parseInt(task.statusId, 10);
    if (Number.isInteger(statusId) && tasksByStatus.has(statusId)) {
      tasksByStatus.get(statusId).push(task);
    } else {
      backlog.push(task);
    }
  });

  const columns = [];
  if (backlog.length) {
    columns.push({ id: null, name: 'Backlog', tasks: backlog });
  }
  state.statuses.forEach(status => {
    columns.push({ id: status.id, name: status.name, tasks: tasksByStatus.get(status.id) || [] });
  });

  columns.forEach(column => {
    const columnEl = document.createElement('section');
    columnEl.className = 'kanban-column';

    const header = document.createElement('div');
    header.className = 'kanban-column__header';
    const title = document.createElement('h3');
    title.textContent = column.name;
    header.appendChild(title);
    const count = document.createElement('span');
    count.className = 'badge';
    count.textContent = `${column.tasks.length}`;
    header.appendChild(count);
    columnEl.appendChild(header);

    const list = document.createElement('div');
    list.className = 'kanban-column__tasks';
    if (!column.tasks.length) {
      const empty = document.createElement('p');
      empty.textContent = 'No tasks here yet.';
      empty.style.color = 'var(--text-secondary)';
      empty.style.fontSize = '0.85rem';
      list.appendChild(empty);
    } else {
      column.tasks
        .slice()
        .sort((a, b) => {
          if (a.completed !== b.completed) {
            return a.completed ? 1 : -1;
          }
          if (a.dueDate && b.dueDate) {
            return a.dueDate.localeCompare(b.dueDate);
          }
          return a.id - b.id;
        })
        .forEach(task => list.appendChild(createTaskCard(task)));
    }

    columnEl.appendChild(list);
    dom.kanbanBoard.appendChild(columnEl);
  });
}

function createTaskCard(task) {
  const card = document.createElement('article');
  card.className = 'task-card';

  const top = document.createElement('div');
  top.className = 'task-card__top';

  const titleButton = document.createElement('button');
  titleButton.className = 'task-card__title';
  titleButton.type = 'button';
  titleButton.textContent = task.title;
  titleButton.addEventListener('click', () => openTaskDrawer(task.id));
  top.appendChild(titleButton);

  const controls = document.createElement('div');
  controls.className = 'task-card__controls';

  const completeToggle = document.createElement('input');
  completeToggle.type = 'checkbox';
  completeToggle.checked = Boolean(task.completed);
  completeToggle.title = 'Mark completed';
  completeToggle.addEventListener('change', async () => {
    try {
      const updated = await callApi(`/projects/${task.projectId}/tasks/${task.id}`, {
        method: 'PATCH',
        body: { completed: completeToggle.checked },
      });
      updateTaskInState(updated);
      renderWorkspace();
      renderBoard();
      showToast('Task updated', 'success');
    } catch (err) {
      completeToggle.checked = !completeToggle.checked;
      showToast(err.message, 'error');
    }
  });
  controls.appendChild(completeToggle);

  const statusSelect = document.createElement('select');
  statusSelect.title = 'Move to status';
  state.statuses.forEach(status => {
    const option = document.createElement('option');
    option.value = status.id;
    option.textContent = status.name;
    statusSelect.appendChild(option);
  });
  const currentStatusId = typeof task.statusId === 'number' ? task.statusId : parseInt(task.statusId, 10);
  if (Number.isInteger(currentStatusId)) {
    statusSelect.value = String(currentStatusId);
  }
  statusSelect.addEventListener('change', async () => {
    const newStatusId = parseInt(statusSelect.value, 10);
    if (!Number.isInteger(newStatusId)) return;
    try {
      const updated = await callApi(`/projects/${task.projectId}/tasks/${task.id}`, {
        method: 'PATCH',
        body: { statusId: newStatusId },
      });
      updateTaskInState(updated);
      renderBoard();
      showToast('Task moved', 'success');
    } catch (err) {
      statusSelect.value = String(currentStatusId);
      showToast(err.message, 'error');
    }
  });
  controls.appendChild(statusSelect);

  top.appendChild(controls);
  card.appendChild(top);

  const meta = document.createElement('div');
  meta.className = 'task-card__meta';

  const priorityBadge = document.createElement('span');
  priorityBadge.className = `badge priority-${task.priority || 'medium'}`;
  priorityBadge.textContent = (task.priority || 'medium').toUpperCase();
  meta.appendChild(priorityBadge);

  if (task.dueDate) {
    const due = document.createElement('span');
    const date = new Date(task.dueDate);
    if (!Number.isNaN(date.valueOf())) {
      due.className = 'badge';
      due.textContent = `Due ${date.toLocaleDateString()}`;
    } else {
      due.className = 'badge';
      due.textContent = `Due ${task.dueDate}`;
    }
    meta.appendChild(due);
  }

  if (task.completed) {
    const completedBadge = document.createElement('span');
    completedBadge.className = 'badge';
    completedBadge.textContent = 'Completed';
    meta.appendChild(completedBadge);
  }

  const metaInfo = state.taskMeta[task.id];
  if (metaInfo) {
    if (metaInfo.subtasks) {
      const subBadge = document.createElement('span');
      subBadge.className = 'badge';
      subBadge.textContent = `${metaInfo.subtasks.completed}/${metaInfo.subtasks.total} subtasks`;
      meta.appendChild(subBadge);
    }
    if (typeof metaInfo.comments === 'number') {
      const commentBadge = document.createElement('span');
      commentBadge.className = 'badge';
      commentBadge.textContent = `${metaInfo.comments} comment${metaInfo.comments === 1 ? '' : 's'}`;
      meta.appendChild(commentBadge);
    }
  }

  card.appendChild(meta);
  return card;
}

function updateTaskInState(updatedTask) {
  const index = state.tasks.findIndex(t => t.id === updatedTask.id);
  if (index !== -1) {
    state.tasks[index] = { ...state.tasks[index], ...updatedTask };
  }
}

function removeTaskFromState(taskId) {
  state.tasks = state.tasks.filter(task => task.id !== taskId);
  delete state.taskMeta[taskId];
  state.taskDetailsCache.delete(taskId);
}

function openTaskDrawer(taskId) {
  const project = getCurrentProject();
  if (!project) return;
  state.taskDrawerOpenId = taskId;
  dom.taskDrawer.classList.add('open');
  dom.taskDrawer.setAttribute('aria-hidden', 'false');
  refreshTaskDetails(taskId).catch(err => showToast(err.message, 'error'));
}

function closeTaskDrawer() {
  state.taskDrawerOpenId = null;
  dom.taskDrawer.classList.remove('open');
  dom.taskDrawer.setAttribute('aria-hidden', 'true');
  hideToast();
}

async function refreshTaskDetails(taskId) {
  const project = getCurrentProject();
  if (!project) return;
  try {
    const [task, subtasks, comments] = await Promise.all([
      callApi(`/projects/${project.id}/tasks/${taskId}`),
      callApi(`/projects/${project.id}/tasks/${taskId}/subtasks`),
      callApi(`/projects/${project.id}/tasks/${taskId}/comments`),
    ]);
    updateTaskInState(task);
    const meta = {
      subtasks: {
        total: Array.isArray(subtasks) ? subtasks.length : 0,
        completed: Array.isArray(subtasks) ? subtasks.filter(s => s.completed).length : 0,
      },
      comments: Array.isArray(comments) ? comments.length : 0,
    };
    state.taskMeta[taskId] = meta;
    state.taskDetailsCache.set(taskId, { subtasks: subtasks || [], comments: comments || [] });
    renderBoard();
    renderTaskDrawer(task, subtasks || [], comments || []);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderTaskDrawer(task, subtasks, comments) {
  dom.taskDrawerTitle.textContent = task.title;
  dom.taskDetailTitle.value = task.title;
  dom.taskDetailPriority.value = task.priority || 'medium';
  dom.taskDetailCompleted.checked = Boolean(task.completed);
  if (dom.taskDetailStatus && dom.taskDetailStatus.options.length) {
    const desired = task.statusId ? String(task.statusId) : (state.statuses[0] ? String(state.statuses[0].id) : '');
    const optionExists = Array.from(dom.taskDetailStatus.options).some(option => option.value === desired);
    dom.taskDetailStatus.value = optionExists ? desired : dom.taskDetailStatus.options[0].value;
  }
  dom.taskDetailDueDate.value = task.dueDate || '';

  dom.subtaskList.innerHTML = '';
  subtasks.forEach(subtask => {
    const item = document.createElement('li');
    item.className = 'subtask-item';
    const row = document.createElement('div');
    row.className = 'subtask-row';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = Boolean(subtask.completed);
    checkbox.addEventListener('change', async () => {
      try {
        const updated = await callApi(`/projects/${task.projectId}/tasks/${task.id}/subtasks/${subtask.id}`, {
          method: 'PATCH',
          body: { completed: checkbox.checked },
        });
        const cache = state.taskDetailsCache.get(task.id);
        if (cache) {
          const idx = cache.subtasks.findIndex(s => s.id === subtask.id);
          if (idx !== -1) {
            cache.subtasks[idx] = updated;
          }
          state.taskMeta[task.id] = {
            subtasks: {
              total: cache.subtasks.length,
              completed: cache.subtasks.filter(s => s.completed).length,
            },
            comments: state.taskMeta[task.id]?.comments || 0,
          };
        }
        renderBoard();
        renderTaskDrawer(task, cache ? cache.subtasks : subtasks, comments);
      } catch (err) {
        checkbox.checked = !checkbox.checked;
        showToast(err.message, 'error');
      }
    });

    const label = document.createElement('span');
    label.textContent = subtask.title;

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'ghost danger';
    removeBtn.textContent = 'Delete';
    removeBtn.addEventListener('click', async () => {
      if (!confirm('Delete subtask?')) return;
      try {
        await callApi(`/projects/${task.projectId}/tasks/${task.id}/subtasks/${subtask.id}`, { method: 'DELETE' });
        showToast('Subtask removed', 'success');
        refreshTaskDetails(task.id);
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    row.appendChild(checkbox);
    row.appendChild(label);
    row.appendChild(removeBtn);
    item.appendChild(row);
    dom.subtaskList.appendChild(item);
  });

  dom.commentList.innerHTML = '';
  comments.forEach(comment => {
    const item = document.createElement('li');
    item.className = 'comment-item';

    const meta = document.createElement('div');
    meta.className = 'comment-meta';
    const author = state.members.find(member => member.id === comment.userId);
    const authorSpan = document.createElement('span');
    authorSpan.textContent = author ? author.username : `User #${comment.userId}`;
    meta.appendChild(authorSpan);

    if (comment.userId === (state.user && state.user.id)) {
      const actions = document.createElement('div');
      actions.className = 'comment-actions';

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'ghost';
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', async () => {
        const next = prompt('Update comment', comment.text);
        if (!next || next.trim() === comment.text) return;
        try {
          const updated = await callApi(`/projects/${task.projectId}/tasks/${task.id}/comments/${comment.id}`, {
            method: 'PATCH',
            body: { text: next.trim() },
          });
          comment.text = updated.text;
          refreshTaskDetails(task.id);
          showToast('Comment updated', 'success');
        } catch (err) {
          showToast(err.message, 'error');
        }
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'ghost danger';
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', async () => {
        if (!confirm('Delete this comment?')) return;
        try {
          await callApi(`/projects/${task.projectId}/tasks/${task.id}/comments/${comment.id}`, { method: 'DELETE' });
          showToast('Comment deleted', 'success');
          refreshTaskDetails(task.id);
        } catch (err) {
          showToast(err.message, 'error');
        }
      });

      actions.appendChild(editBtn);
      actions.appendChild(deleteBtn);
      meta.appendChild(actions);
    }

    item.appendChild(meta);

    const body = document.createElement('p');
    body.style.margin = '0';
    body.textContent = comment.text;
    item.appendChild(body);
    dom.commentList.appendChild(item);
  });
}

function bindEvents() {
  dom.registerForm.addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const username = form.username.value.trim();
    const password = form.password.value;
    if (password.length < 8) {
      showToast('Password must be at least 8 characters long', 'error');
      return;
    }
    try {
      await callApi('/auth/register', {
        method: 'POST',
        body: { username, password },
      });
      showToast('Registration successful. You can now sign in.', 'success');
      form.reset();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  dom.loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const username = form.username.value.trim();
    const password = form.password.value;
    try {
      const result = await callApi('/auth/login', {
        method: 'POST',
        body: { username, password },
      });
      setToken(result.token, result.expiresAt);
      await resumeSession();
      form.reset();
      showToast('Welcome back!', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  dom.logoutBtn.addEventListener('click', async () => {
    try {
      await callApi('/auth/logout', { method: 'POST' });
    } catch (err) {
      // Ignore logout errors
    }
    setToken(null);
    handleUnauthorized();
  });

  dom.projectForm.addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const name = form.name.value.trim();
    if (!name) return;
    try {
      const project = await callApi('/projects', {
        method: 'POST',
        body: { name },
      });
      showToast('Project created', 'success');
      form.reset();
      await loadProjects();
      await loadProjectContext(project.id);
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  dom.refreshProjectsBtn.addEventListener('click', () => {
    loadProjects();
  });

  dom.memberForm.addEventListener('submit', async event => {
    event.preventDefault();
    const project = getCurrentProject();
    if (!project) return;
    const username = event.currentTarget.username.value.trim();
    if (!username) return;
    try {
      await callApi(`/projects/${project.id}/members`, {
        method: 'POST',
        body: { username },
      });
      showToast('Invitation sent', 'success');
      event.currentTarget.reset();
      await loadProjectContext(project.id);
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  dom.renameProjectBtn.addEventListener('click', async () => {
    const project = getCurrentProject();
    if (!project) return;
    const next = prompt('Project name', project.name);
    if (!next || next.trim() === project.name) return;
    try {
      const updated = await callApi(`/projects/${project.id}`, {
        method: 'PATCH',
        body: { name: next.trim() },
      });
      const index = state.projects.findIndex(p => p.id === project.id);
      if (index !== -1) {
        state.projects[index] = updated;
      }
      renderProjects();
      renderWorkspace();
      showToast('Project renamed', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  dom.deleteProjectBtn.addEventListener('click', async () => {
    const project = getCurrentProject();
    if (!project) return;
    if (!confirm(`Delete project “${project.name}”? This cannot be undone.`)) return;
    try {
      await callApi(`/projects/${project.id}`, { method: 'DELETE' });
      showToast('Project deleted', 'success');
      state.currentProjectId = null;
      await loadProjects();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  dom.taskForm.addEventListener('submit', async event => {
    event.preventDefault();
    const project = getCurrentProject();
    if (!project) return;
    const form = event.currentTarget;
    const payload = {
      title: form.title.value.trim(),
      dueDate: form.dueDate.value || undefined,
      priority: form.priority.value,
      statusId: form.statusId.value ? parseInt(form.statusId.value, 10) : undefined,
    };
    if (!payload.title) return;
    try {
      const created = await callApi(`/projects/${project.id}/tasks`, {
        method: 'POST',
        body: payload,
      });
      state.tasks.push(created);
      form.reset();
      renderWorkspace();
      renderBoard();
      showToast('Task created', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  dom.statusForm.addEventListener('submit', async event => {
    event.preventDefault();
    const project = getCurrentProject();
    if (!project) return;
    const name = event.currentTarget.name.value.trim();
    if (!name) return;
    try {
      const status = await callApi(`/projects/${project.id}/statuses`, {
        method: 'POST',
        body: { name },
      });
      state.statuses.push(status);
      event.currentTarget.reset();
      renderStatusManager();
      showToast('Status created', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  dom.closeTaskDrawer.addEventListener('click', () => {
    closeTaskDrawer();
  });

  dom.taskEditForm.addEventListener('submit', async event => {
    event.preventDefault();
    const project = getCurrentProject();
    if (!project || !state.taskDrawerOpenId) return;
    const payload = {
      title: dom.taskDetailTitle.value.trim(),
      priority: dom.taskDetailPriority.value,
      completed: dom.taskDetailCompleted.checked,
    };
    if (dom.taskDetailDueDate.value) {
      payload.dueDate = dom.taskDetailDueDate.value;
    } else {
      payload.dueDate = null;
    }
    if (dom.taskDetailStatus.value) {
      payload.statusId = parseInt(dom.taskDetailStatus.value, 10);
    }
    try {
      const updated = await callApi(`/projects/${project.id}/tasks/${state.taskDrawerOpenId}`, {
        method: 'PATCH',
        body: payload,
      });
      updateTaskInState(updated);
      renderWorkspace();
      renderBoard();
      refreshTaskDetails(updated.id);
      showToast('Task saved', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  dom.taskDeleteBtn.addEventListener('click', async () => {
    const project = getCurrentProject();
    const taskId = state.taskDrawerOpenId;
    if (!project || !taskId) return;
    if (!confirm('Delete this task?')) return;
    try {
      await callApi(`/projects/${project.id}/tasks/${taskId}`, { method: 'DELETE' });
      removeTaskFromState(taskId);
      renderWorkspace();
      renderBoard();
      closeTaskDrawer();
      showToast('Task deleted', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  dom.subtaskForm.addEventListener('submit', async event => {
    event.preventDefault();
    const project = getCurrentProject();
    const taskId = state.taskDrawerOpenId;
    if (!project || !taskId) return;
    const title = event.currentTarget.title.value.trim();
    if (!title) return;
    try {
      await callApi(`/projects/${project.id}/tasks/${taskId}/subtasks`, {
        method: 'POST',
        body: { title },
      });
      event.currentTarget.reset();
      showToast('Subtask added', 'success');
      refreshTaskDetails(taskId);
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  dom.commentForm.addEventListener('submit', async event => {
    event.preventDefault();
    const project = getCurrentProject();
    const taskId = state.taskDrawerOpenId;
    if (!project || !taskId) return;
    const text = dom.commentText.value.trim();
    if (!text) return;
    try {
      await callApi(`/projects/${project.id}/tasks/${taskId}/comments`, {
        method: 'POST',
        body: { text },
      });
      dom.commentText.value = '';
      showToast('Comment posted', 'success');
      refreshTaskDetails(taskId);
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

async function init() {
  loadPersistedToken();
  updateAuthVisibility();
  bindEvents();
  await checkApiHealth();
  if (state.token) {
    await resumeSession();
  }
}

init();
