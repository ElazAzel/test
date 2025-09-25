# Project Management App

This repository contains a multi-user project management application that spans the full lifecycle of event-style projects: preparation, execution, and closing. It ships with secure authentication, collaborative project spaces, kanban workflows, subtasks, comments, prioritisation, and persistence-ready backend storage.

## Structure

- `backend/` – Node.js server that handles authentication, membership, projects, tasks, statuses, subtasks, comments, and persistent storage.
- `frontend/` – Modern single-page experience with authentication, kanban board, task drawer, member management, and Vercel-friendly routing.

## Backend

Run the server:

```
cd backend
npm start
```

### API

- `POST /auth/register` – `{ "username": "...", "password": "..." }` → create user (password must be at least 8 characters and is stored as a salted hash).
- `POST /auth/login` – `{ "username": "...", "password": "..." }` → returns `{ token, expiresAt }` where `expiresAt` is the UNIX timestamp in milliseconds when the token will expire.
- `GET /auth/me` – with `Authorization: Bearer <token>` → returns current user info.
- `POST /auth/logout` – with `Authorization: Bearer <token>` → invalidate the current session.
- `POST /projects` – `{ "name": "..." }` with `Authorization: Bearer <token>` → create project (creator becomes owner).
- `GET /projects` – list projects where the current user is a member.
- `PATCH /projects/:id` – update project fields like `name` (owner only).
- `DELETE /projects/:id` – remove a project and all its tasks (owner only).
- `POST /projects/:id/members` – `{ "username": "..." }` with `Authorization: Bearer <token>` (owner only) → invite an existing user to the project.
- `GET /projects/:id/members` – list project members (must belong to the project).
- `DELETE /projects/:id/members/:userId` – remove a member from the project (owner only).
- `POST /projects/:id/statuses` – `{ "name": "..." }` with `Authorization: Bearer <token>` (owner only) → add a task status column.
- `GET /projects/:id/statuses` – list status columns for a project.
- `PATCH /projects/:id/statuses/:statusId` – rename a status column (owner only).
- `DELETE /projects/:id/statuses/:statusId` – remove a status column and reassign tasks (owner only).
- `POST /projects/:id/tasks` – `{ "title": "...", "statusId?": number, "dueDate?": "YYYY-MM-DD", "priority?": "low"|"medium"|"high" }` with `Authorization: Bearer <token>` → create task in project.
- `GET /projects/:id/tasks` – list tasks for a project (each task has `id`, `title`, `completed`, `statusId`, `priority` and optional `dueDate`).
- `GET /projects/:id/tasks/:taskId` – fetch a single task by its id.
- `PATCH /projects/:id/tasks/:taskId` – update task fields like `title`, `completed`, `statusId`, `dueDate` or `priority`.
- `DELETE /projects/:id/tasks/:taskId` – remove a task from a project.
- `POST /projects/:id/tasks/:taskId/subtasks` – `{ "title": "..." }` with `Authorization: Bearer <token>` → add subtask to a task.
- `GET /projects/:id/tasks/:taskId/subtasks` – list subtasks for a task (each subtask has `id`, `title` and `completed`).
- `PATCH /projects/:id/tasks/:taskId/subtasks/:subtaskId` – update subtask fields like `title` or `completed`.
- `DELETE /projects/:id/tasks/:taskId/subtasks/:subtaskId` – remove a subtask from a task.
- `POST /projects/:id/tasks/:taskId/comments` – `{ "text": "..." }` with `Authorization: Bearer <token>` → add comment to a task.
- `GET /projects/:id/tasks/:taskId/comments` – list comments for a task (each comment has `id`, `userId` and `text`).
- `PATCH /projects/:id/tasks/:taskId/comments/:commentId` – update a comment's `text` (only its author).
- `DELETE /projects/:id/tasks/:taskId/comments/:commentId` – remove a comment (only its author).

By default the backend keeps everything in memory so it works on read-only hosts such as Vercel’s serverless runtime. Passwords are never stored in plaintext; PBKDF2 with a per-user salt is used. Session tokens automatically expire and, when persistence is enabled, are pruned from the data file.

### Configuration

You can customise the backend through environment variables before launching the server:

- `DATA_FILE` – opt into persistence by pointing to a writable JSON file (for example, `DATA_FILE=/tmp/data.json`). If unset, the server remains purely in-memory which avoids write attempts on platforms that do not allow binary files.
- `TOKEN_TTL_MS` – change the token lifetime in milliseconds (defaults to 86 400 000, i.e. 24 hours).

If `DATA_FILE` points to a new directory it will be created automatically.

## Frontend

Serve the static application:

```
cd frontend
npm start
```

The app at [http://localhost:8080](http://localhost:8080) offers a full dashboard experience optimised for both desktop and mobile:

- **Authentication & session recovery** – register, sign in, and resume sessions automatically thanks to persisted tokens.
- **Project workspace** – manage multiple closed projects, see member counts, rename or archive initiatives, and invite collaborators.
- **Kanban board** – drag-free yet column-based workflow where tasks are grouped by status, display due dates, priorities, completion state, and live subtasks/comment counters.
- **Task composer** – capture title, due date, priority, and target status in one inline control bar.
- **Detail drawer** – inspect or update a task, toggle completion, move between statuses, adjust priority/due date, manage subtasks, and collaborate via threaded comments.
- **Role-aware controls** – project owners can create, rename, or remove status columns and manage members directly from the sidebar, while contributors retain task and conversation tools.

When running locally the frontend automatically talks to the backend on port `3000`. In production (for example on Vercel) it uses same-origin requests under the `/api` prefix so no manual configuration is required.

## Development

From the repository root you can manage both services:

```bash
npm run install:all   # install dependencies for backend and frontend
npm test              # run tests for both parts
npm start             # launch backend (port 3000) and frontend (port 8080)
```

Each subdirectory also contains its own `package.json` with individual scripts like `npm start` and `npm test`.

## Continuous Integration

GitHub Actions runs the test suite on every push and pull request. The workflow installs dependencies for both the backend and frontend before executing `npm test`.

## Deployment

The project includes a `vercel.json` configuration so it can be deployed to [Vercel](https://vercel.com). The static frontend is served from the `frontend` directory, and the backend is exposed as a serverless function under `/api`.

To deploy:

```bash
npm run deploy
```

Deployment uploads exclude repository metadata and test files thanks to the `.vercelignore` configuration, keeping the production bundle lean.

## License

Released under the [MIT license](LICENSE).
