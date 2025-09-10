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

All data is stored in memory and clears on restart.

## Development

Each directory contains a `package.json` with a placeholder `test` script. Run `npm test` in the respective directory.
