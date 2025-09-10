# Project Management App

This repository contains a minimal starting point for a multi-user project management application.

## Structure

- `backend/` – Node.js server with in-memory storage and basic routes for authentication and projects.
- `frontend/` – Static HTML/JS placeholder for the client side.

## Backend

Run the server:

```
cd backend
npm start
```

### API

- `POST /auth/register` – `{ "username": "...", "password": "..." }` → create user.
- `POST /auth/login` – `{ "username": "...", "password": "..." }` → returns `{ token }`.
- `POST /projects` – `{ "name": "..." }` with `Authorization: Bearer <token>` → create project.
- `GET /projects` – list projects for current user.
- `POST /projects/:id/tasks` – `{ "title": "..." }` with `Authorization: Bearer <token>` → create task in project.
- `GET /projects/:id/tasks` – list tasks for a project (each task has `id`, `title` and `completed`).
- `PATCH /projects/:id/tasks/:taskId` – update task fields like `title` or `completed`.
- `DELETE /projects/:id/tasks/:taskId` – remove a task from a project.

All data is stored in memory and clears on restart.

## Frontend

Serve the static page:

```
cd frontend
npm start
```

The page will be available on [http://localhost:8080](http://localhost:8080) and attempts to fetch the backend root (`/api`).

## Development

From the repository root you can manage both services:

```bash
npm run install:all   # install dependencies for backend and frontend
npm test              # run tests for both parts
npm start             # launch backend (port 3000) and frontend (port 8080)
```

Each subdirectory also contains its own `package.json` with individual scripts like `npm start` and `npm test`.

## Deployment

The project includes a `vercel.json` configuration so it can be deployed to [Vercel](https://vercel.com). The static frontend is served from the `frontend` directory, and the backend is exposed as a serverless function under `/api`.

To deploy:

```bash
npm run install:all
npx vercel
```
