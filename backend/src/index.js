const http = require('http');

const users = [];
let nextUserId = 1;
const sessions = new Map();
const projects = [];
let nextProjectId = 1;
const tasks = [];
let nextTaskId = 1;
const subtasks = [];
let nextSubtaskId = 1;
const comments = [];
let nextCommentId = 1;

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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

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

  if (req.method === 'POST' && req.url === '/auth/logout') {
    const auth = req.headers['authorization'] || '';
    const token = auth.split(' ')[1];
    if (token && sessions.has(token)) {
      sessions.delete(token);
      res.writeHead(204);
      return res.end();
    }
    return send(res, 401, { error: 'invalid token' });
  }

  if (req.method === 'GET' && req.url === '/auth/me') {
    const user = authenticate(req);
    if (!user) {
      return send(res, 401, { error: 'unauthorized' });
    }
    return send(res, 200, { id: user.id, username: user.username });
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
      const project = { id: nextProjectId++, name, ownerId: user.id, members: [user.id] };
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
    const userProjects = projects.filter(p => p.members.includes(user.id));
    return send(res, 200, userProjects);
  }

  const singleProjectMatch = req.url.match(/^\/projects\/(\d+)$/);
  if (singleProjectMatch && req.method === 'PATCH') {
    const user = authenticate(req);
    if (!user) {
      return send(res, 401, { error: 'unauthorized' });
    }
    const projectId = parseInt(singleProjectMatch[1], 10);
    const project = projects.find(p => p.id === projectId && p.ownerId === user.id);
    if (!project) {
      return send(res, 404, { error: 'project not found' });
    }
    try {
      const body = await parseBody(req);
      if (body.name !== undefined) {
        project.name = body.name;
      }
      return send(res, 200, project);
    } catch (err) {
      return send(res, 400, { error: 'invalid json' });
    }
  }

  if (singleProjectMatch && req.method === 'DELETE') {
    const user = authenticate(req);
    if (!user) {
      return send(res, 401, { error: 'unauthorized' });
    }
    const projectId = parseInt(singleProjectMatch[1], 10);
    const index = projects.findIndex(p => p.id === projectId && p.ownerId === user.id);
    if (index === -1) {
      return send(res, 404, { error: 'project not found' });
    }
    projects.splice(index, 1);

    for (let i = tasks.length - 1; i >= 0; i--) {
      if (tasks[i].projectId === projectId) {
        const removedTaskId = tasks[i].id;
        tasks.splice(i, 1);
        for (let j = subtasks.length - 1; j >= 0; j--) {
          if (subtasks[j].taskId === removedTaskId) {
            subtasks.splice(j, 1);
          }
        }
        for (let k = comments.length - 1; k >= 0; k--) {
          if (comments[k].taskId === removedTaskId) {
            comments.splice(k, 1);
          }
        }
      }
    }

    res.writeHead(204);
    return res.end();
  }

  const projectMembersMatch = req.url.match(/^\/projects\/(\d+)\/members$/);
  if (projectMembersMatch && req.method === 'POST') {
    const user = authenticate(req);
    if (!user) {
      return send(res, 401, { error: 'unauthorized' });
    }
    const projectId = parseInt(projectMembersMatch[1], 10);
    const project = projects.find(p => p.id === projectId && p.ownerId === user.id);
    if (!project) {
      return send(res, 404, { error: 'project not found' });
    }
    try {
      const body = await parseBody(req);
      const { username } = body;
      if (!username) {
        return send(res, 400, { error: 'username required' });
      }
      const member = users.find(u => u.username === username);
      if (!member) {
        return send(res, 404, { error: 'user not found' });
      }
      if (!project.members.includes(member.id)) {
        project.members.push(member.id);
      }
      return send(res, 201, { id: member.id, username: member.username });
    } catch (err) {
      return send(res, 400, { error: 'invalid json' });
    }
  }

  if (projectMembersMatch && req.method === 'GET') {
    const user = authenticate(req);
    if (!user) {
      return send(res, 401, { error: 'unauthorized' });
    }
    const projectId = parseInt(projectMembersMatch[1], 10);
    const project = projects.find(p => p.id === projectId && p.members.includes(user.id));
    if (!project) {
      return send(res, 404, { error: 'project not found' });
    }
    const list = project.members.map(id => {
      const u = users.find(usr => usr.id === id);
      return { id: u.id, username: u.username };
    });
    return send(res, 200, list);
  }

  const singleMemberMatch = req.url.match(/^\/projects\/(\d+)\/members\/(\d+)$/);
  if (singleMemberMatch && req.method === 'DELETE') {
    const user = authenticate(req);
    if (!user) {
      return send(res, 401, { error: 'unauthorized' });
    }
    const projectId = parseInt(singleMemberMatch[1], 10);
    const memberId = parseInt(singleMemberMatch[2], 10);
    const project = projects.find(p => p.id === projectId && p.ownerId === user.id);
    if (!project) {
      return send(res, 404, { error: 'project not found' });
    }
    if (memberId === project.ownerId) {
      return send(res, 400, { error: 'cannot remove owner' });
    }
    const index = project.members.indexOf(memberId);
    if (index === -1) {
      return send(res, 404, { error: 'member not found' });
    }
    project.members.splice(index, 1);
    res.writeHead(204);
    return res.end();
  }

  const projectTasksMatch = req.url.match(/^\/projects\/(\d+)\/tasks$/);
  if (projectTasksMatch && req.method === 'POST') {
    const user = authenticate(req);
    if (!user) {
      return send(res, 401, { error: 'unauthorized' });
    }
    const projectId = parseInt(projectTasksMatch[1], 10);
    const project = projects.find(p => p.id === projectId && p.members.includes(user.id));
    if (!project) {
      return send(res, 404, { error: 'project not found' });
    }
    try {
      const body = await parseBody(req);
      const { title } = body;
      if (!title) {
        return send(res, 400, { error: 'title required' });
      }
      const task = { id: nextTaskId++, projectId, title, completed: false };
      tasks.push(task);
      return send(res, 201, task);
    } catch (err) {
      return send(res, 400, { error: 'invalid json' });
    }
  }

  if (projectTasksMatch && req.method === 'GET') {
    const user = authenticate(req);
    if (!user) {
      return send(res, 401, { error: 'unauthorized' });
    }
    const projectId = parseInt(projectTasksMatch[1], 10);
    const project = projects.find(p => p.id === projectId && p.members.includes(user.id));
    if (!project) {
      return send(res, 404, { error: 'project not found' });
    }
    const projectTasks = tasks.filter(t => t.projectId === projectId);
    return send(res, 200, projectTasks);
  }

  const singleTaskMatch = req.url.match(/^\/projects\/(\d+)\/tasks\/(\d+)$/);
  if (singleTaskMatch && req.method === 'PATCH') {
    const user = authenticate(req);
    if (!user) {
      return send(res, 401, { error: 'unauthorized' });
    }
    const projectId = parseInt(singleTaskMatch[1], 10);
    const taskId = parseInt(singleTaskMatch[2], 10);
    const project = projects.find(p => p.id === projectId && p.members.includes(user.id));
    if (!project) {
      return send(res, 404, { error: 'project not found' });
    }
    const task = tasks.find(t => t.id === taskId && t.projectId === projectId);
    if (!task) {
      return send(res, 404, { error: 'task not found' });
    }
    try {
      const body = await parseBody(req);
      if (body.title !== undefined) {
        task.title = body.title;
      }
      if (body.completed !== undefined) {
        task.completed = !!body.completed;
      }
      return send(res, 200, task);
    } catch (err) {
      return send(res, 400, { error: 'invalid json' });
    }
  }

  if (singleTaskMatch && req.method === 'DELETE') {
    const user = authenticate(req);
    if (!user) {
      return send(res, 401, { error: 'unauthorized' });
    }
    const projectId = parseInt(singleTaskMatch[1], 10);
    const taskId = parseInt(singleTaskMatch[2], 10);
    const project = projects.find(p => p.id === projectId && p.members.includes(user.id));
    if (!project) {
      return send(res, 404, { error: 'project not found' });
    }
    const index = tasks.findIndex(t => t.id === taskId && t.projectId === projectId);
    if (index === -1) {
      return send(res, 404, { error: 'task not found' });
    }
    tasks.splice(index, 1);
    res.writeHead(204);
    return res.end();
  }

  const taskSubtasksMatch = req.url.match(/^\/projects\/(\d+)\/tasks\/(\d+)\/subtasks$/);
  if (taskSubtasksMatch && req.method === 'POST') {
    const user = authenticate(req);
    if (!user) {
      return send(res, 401, { error: 'unauthorized' });
    }
    const projectId = parseInt(taskSubtasksMatch[1], 10);
    const taskId = parseInt(taskSubtasksMatch[2], 10);
    const project = projects.find(p => p.id === projectId && p.members.includes(user.id));
    if (!project) {
      return send(res, 404, { error: 'project not found' });
    }
    const task = tasks.find(t => t.id === taskId && t.projectId === projectId);
    if (!task) {
      return send(res, 404, { error: 'task not found' });
    }
    try {
      const body = await parseBody(req);
      const { title } = body;
      if (!title) {
        return send(res, 400, { error: 'title required' });
      }
      const subtask = { id: nextSubtaskId++, taskId, title, completed: false };
      subtasks.push(subtask);
      return send(res, 201, subtask);
    } catch (err) {
      return send(res, 400, { error: 'invalid json' });
    }
  }

  if (taskSubtasksMatch && req.method === 'GET') {
    const user = authenticate(req);
    if (!user) {
      return send(res, 401, { error: 'unauthorized' });
    }
    const projectId = parseInt(taskSubtasksMatch[1], 10);
    const taskId = parseInt(taskSubtasksMatch[2], 10);
    const project = projects.find(p => p.id === projectId && p.members.includes(user.id));
    if (!project) {
      return send(res, 404, { error: 'project not found' });
    }
    const task = tasks.find(t => t.id === taskId && t.projectId === projectId);
    if (!task) {
      return send(res, 404, { error: 'task not found' });
    }
    const taskSubtasks = subtasks.filter(s => s.taskId === taskId);
    return send(res, 200, taskSubtasks);
  }

  const singleSubtaskMatch = req.url.match(/^\/projects\/(\d+)\/tasks\/(\d+)\/subtasks\/(\d+)$/);
  if (singleSubtaskMatch && req.method === 'PATCH') {
    const user = authenticate(req);
    if (!user) {
      return send(res, 401, { error: 'unauthorized' });
    }
    const projectId = parseInt(singleSubtaskMatch[1], 10);
    const taskId = parseInt(singleSubtaskMatch[2], 10);
    const subtaskId = parseInt(singleSubtaskMatch[3], 10);
    const project = projects.find(p => p.id === projectId && p.members.includes(user.id));
    if (!project) {
      return send(res, 404, { error: 'project not found' });
    }
    const task = tasks.find(t => t.id === taskId && t.projectId === projectId);
    if (!task) {
      return send(res, 404, { error: 'task not found' });
    }
    const subtask = subtasks.find(s => s.id === subtaskId && s.taskId === taskId);
    if (!subtask) {
      return send(res, 404, { error: 'subtask not found' });
    }
    try {
      const body = await parseBody(req);
      if (body.title !== undefined) {
        subtask.title = body.title;
      }
      if (body.completed !== undefined) {
        subtask.completed = !!body.completed;
      }
      return send(res, 200, subtask);
    } catch (err) {
      return send(res, 400, { error: 'invalid json' });
    }
  }

  if (singleSubtaskMatch && req.method === 'DELETE') {
    const user = authenticate(req);
    if (!user) {
      return send(res, 401, { error: 'unauthorized' });
    }
    const projectId = parseInt(singleSubtaskMatch[1], 10);
    const taskId = parseInt(singleSubtaskMatch[2], 10);
    const subtaskId = parseInt(singleSubtaskMatch[3], 10);
    const project = projects.find(p => p.id === projectId && p.members.includes(user.id));
    if (!project) {
      return send(res, 404, { error: 'project not found' });
    }
    const task = tasks.find(t => t.id === taskId && t.projectId === projectId);
    if (!task) {
      return send(res, 404, { error: 'task not found' });
    }
    const index = subtasks.findIndex(s => s.id === subtaskId && s.taskId === taskId);
    if (index === -1) {
      return send(res, 404, { error: 'subtask not found' });
    }
    subtasks.splice(index, 1);
    res.writeHead(204);
    return res.end();
  }

  const taskCommentsMatch = req.url.match(/^\/projects\/(\d+)\/tasks\/(\d+)\/comments$/);
  if (taskCommentsMatch && req.method === 'POST') {
    const user = authenticate(req);
    if (!user) {
      return send(res, 401, { error: 'unauthorized' });
    }
    const projectId = parseInt(taskCommentsMatch[1], 10);
    const taskId = parseInt(taskCommentsMatch[2], 10);
    const project = projects.find(p => p.id === projectId && p.members.includes(user.id));
    if (!project) {
      return send(res, 404, { error: 'project not found' });
    }
    const task = tasks.find(t => t.id === taskId && t.projectId === projectId);
    if (!task) {
      return send(res, 404, { error: 'task not found' });
    }
    try {
      const body = await parseBody(req);
      const { text } = body;
      if (!text) {
        return send(res, 400, { error: 'text required' });
      }
      const comment = { id: nextCommentId++, taskId, userId: user.id, text };
      comments.push(comment);
      return send(res, 201, comment);
    } catch (err) {
      return send(res, 400, { error: 'invalid json' });
    }
  }

  if (taskCommentsMatch && req.method === 'GET') {
    const user = authenticate(req);
    if (!user) {
      return send(res, 401, { error: 'unauthorized' });
    }
    const projectId = parseInt(taskCommentsMatch[1], 10);
    const taskId = parseInt(taskCommentsMatch[2], 10);
    const project = projects.find(p => p.id === projectId && p.members.includes(user.id));
    if (!project) {
      return send(res, 404, { error: 'project not found' });
    }
    const task = tasks.find(t => t.id === taskId && t.projectId === projectId);
    if (!task) {
      return send(res, 404, { error: 'task not found' });
    }
    const taskComments = comments.filter(c => c.taskId === taskId);
    return send(res, 200, taskComments);
  }

  const singleCommentMatch = req.url.match(/^\/projects\/(\d+)\/tasks\/(\d+)\/comments\/(\d+)$/);
  if (singleCommentMatch && req.method === 'PATCH') {
    const user = authenticate(req);
    if (!user) {
      return send(res, 401, { error: 'unauthorized' });
    }
    const projectId = parseInt(singleCommentMatch[1], 10);
    const taskId = parseInt(singleCommentMatch[2], 10);
    const commentId = parseInt(singleCommentMatch[3], 10);
    const project = projects.find(p => p.id === projectId && p.members.includes(user.id));
    if (!project) {
      return send(res, 404, { error: 'project not found' });
    }
    const task = tasks.find(t => t.id === taskId && t.projectId === projectId);
    if (!task) {
      return send(res, 404, { error: 'task not found' });
    }
    const comment = comments.find(c => c.id === commentId && c.taskId === taskId);
    if (!comment) {
      return send(res, 404, { error: 'comment not found' });
    }
    if (comment.userId !== user.id) {
      return send(res, 403, { error: 'forbidden' });
    }
    try {
      const body = await parseBody(req);
      if (body.text !== undefined) {
        comment.text = body.text;
      }
      return send(res, 200, comment);
    } catch (err) {
      return send(res, 400, { error: 'invalid json' });
    }
  }

  if (singleCommentMatch && req.method === 'DELETE') {
    const user = authenticate(req);
    if (!user) {
      return send(res, 401, { error: 'unauthorized' });
    }
    const projectId = parseInt(singleCommentMatch[1], 10);
    const taskId = parseInt(singleCommentMatch[2], 10);
    const commentId = parseInt(singleCommentMatch[3], 10);
    const project = projects.find(p => p.id === projectId && p.members.includes(user.id));
    if (!project) {
      return send(res, 404, { error: 'project not found' });
    }
    const task = tasks.find(t => t.id === taskId && t.projectId === projectId);
    if (!task) {
      return send(res, 404, { error: 'task not found' });
    }
    const index = comments.findIndex(c => c.id === commentId && c.taskId === taskId);
    if (index === -1) {
      return send(res, 404, { error: 'comment not found' });
    }
    if (comments[index].userId !== user.id) {
      return send(res, 403, { error: 'forbidden' });
    }
    comments.splice(index, 1);
    res.writeHead(204);
    return res.end();
  }

  return send(res, 404, { error: 'Not found' });
};

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  http.createServer(requestListener).listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

module.exports = requestListener;
