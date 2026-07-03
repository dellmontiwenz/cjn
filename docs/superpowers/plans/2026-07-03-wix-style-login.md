# Wix-Style Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-stack Wix-style username/password login app with React, Node.js, Express, MongoDB, bcrypt password hashing, and JWT authentication.

**Architecture:** The project uses a root workspace with separate `client` and `server` apps. The React frontend calls the Express API under `/api/auth`, and the backend persists users in MongoDB through Mongoose. Authentication returns a JWT that the frontend stores in `localStorage` and sends on protected requests.

**Tech Stack:** React, Vite, Vitest, Testing Library, Node.js, Express, Mongoose, bcryptjs, jsonwebtoken, Jest, Supertest, mongodb-memory-server.

---

## File Structure

- Create `package.json`: root scripts to install, test, and run both apps.
- Create `.gitignore`: ignore dependencies, env files, coverage, and build output.
- Create `client/package.json`: frontend dependencies and scripts.
- Create `client/index.html`: Vite entry HTML.
- Create `client/src/main.jsx`: React entry point.
- Create `client/src/App.jsx`: auth screen and logged-in state.
- Create `client/src/App.css`: Wix-style layout and responsive form styling.
- Create `client/src/api.js`: small API client for register, login, and current user calls.
- Create `client/src/App.test.jsx`: frontend behavior tests.
- Create `client/src/setupTests.js`: Testing Library matcher setup.
- Create `server/package.json`: backend dependencies and scripts.
- Create `server/.env.example`: required backend environment variables.
- Create `server/src/server.js`: production server entry point.
- Create `server/src/app.js`: Express app factory and route mounting.
- Create `server/src/db.js`: MongoDB connection helper.
- Create `server/src/models/User.js`: Mongoose user model.
- Create `server/src/middleware/auth.js`: JWT authentication middleware.
- Create `server/src/routes/auth.js`: register, login, and current-user routes.
- Create `server/tests/auth.test.js`: backend auth tests.

## Task 1: Root And Project Scaffold

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `client/package.json`
- Create: `client/index.html`
- Create: `client/src/main.jsx`
- Create: `client/src/setupTests.js`
- Create: `server/package.json`
- Create: `server/.env.example`

- [ ] **Step 1: Create the root package file**

Create `package.json`:

```json
{
  "scripts": {
    "install:all": "npm install --prefix server && npm install --prefix client",
    "dev": "npm run dev --prefix server",
    "dev:server": "npm run dev --prefix server",
    "dev:client": "npm run dev --prefix client",
    "test": "npm test --prefix server && npm test --prefix client"
  }
}
```

- [ ] **Step 2: Create ignore rules**

Create `.gitignore`:

```gitignore
node_modules/
dist/
coverage/
.env
.DS_Store
```

- [ ] **Step 3: Create the frontend package**

Create `client/package.json`:

```json
{
  "type": "module",
  "scripts": {
    "dev": "vite --host 0.0.0.0",
    "build": "vite build",
    "test": "vitest run"
  },
  "dependencies": {
    "@vitejs/plugin-react": "latest",
    "vite": "latest",
    "react": "latest",
    "react-dom": "latest"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "latest",
    "@testing-library/react": "latest",
    "@testing-library/user-event": "latest",
    "jsdom": "latest",
    "vitest": "latest"
  },
  "vitest": {
    "environment": "jsdom",
    "setupFiles": [
      "./src/setupTests.js"
    ]
  }
}
```

- [ ] **Step 4: Create the frontend HTML entry**

Create `client/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Wix-Style Login</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create minimal React test setup**

Create `client/src/setupTests.js`:

```js
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 6: Create temporary React entry point**

Create `client/src/main.jsx`:

```jsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './App.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

- [ ] **Step 7: Create the backend package**

Create `server/package.json`:

```json
{
  "type": "module",
  "scripts": {
    "dev": "node --watch src/server.js",
    "start": "node src/server.js",
    "test": "NODE_ENV=test jest --runInBand"
  },
  "dependencies": {
    "bcryptjs": "latest",
    "cors": "latest",
    "dotenv": "latest",
    "express": "latest",
    "jsonwebtoken": "latest",
    "mongoose": "latest"
  },
  "devDependencies": {
    "jest": "latest",
    "mongodb-memory-server": "latest",
    "supertest": "latest"
  },
  "jest": {
    "testEnvironment": "node"
  }
}
```

- [ ] **Step 8: Create backend env example**

Create `server/.env.example`:

```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/wix_login
JWT_SECRET=change-this-secret
CLIENT_ORIGIN=http://localhost:5173
```

- [ ] **Step 9: Install dependencies**

Run:

```bash
npm run install:all
```

Expected: npm installs dependencies in both `server` and `client` without errors.

## Task 2: Backend Auth API With TDD

**Files:**
- Create: `server/tests/auth.test.js`
- Create: `server/src/app.js`
- Create: `server/src/db.js`
- Create: `server/src/models/User.js`
- Create: `server/src/middleware/auth.js`
- Create: `server/src/routes/auth.js`
- Create: `server/src/server.js`

- [ ] **Step 1: Write failing backend tests**

Create `server/tests/auth.test.js`:

```js
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { User } from '../src/models/User.js';

let mongo;
let app;

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret';
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  app = createApp();
});

afterEach(async () => {
  await User.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

test('registers a new user without storing the plain password', async () => {
  const response = await request(app)
    .post('/api/auth/register')
    .send({ username: 'wendell', password: 'password123' });

  expect(response.status).toBe(201);
  expect(response.body.message).toBe('User registered successfully');

  const user = await User.findOne({ username: 'wendell' });
  expect(user).not.toBeNull();
  expect(user.passwordHash).not.toBe('password123');
});

test('rejects duplicate usernames', async () => {
  await request(app)
    .post('/api/auth/register')
    .send({ username: 'wendell', password: 'password123' });

  const response = await request(app)
    .post('/api/auth/register')
    .send({ username: 'wendell', password: 'password123' });

  expect(response.status).toBe(409);
  expect(response.body.message).toBe('Username already exists');
});

test('logs in with valid credentials and returns a token', async () => {
  await request(app)
    .post('/api/auth/register')
    .send({ username: 'wendell', password: 'password123' });

  const response = await request(app)
    .post('/api/auth/login')
    .send({ username: 'wendell', password: 'password123' });

  expect(response.status).toBe(200);
  expect(response.body.token).toEqual(expect.any(String));
  expect(response.body.user.username).toBe('wendell');
});

test('rejects invalid login credentials', async () => {
  await request(app)
    .post('/api/auth/register')
    .send({ username: 'wendell', password: 'password123' });

  const response = await request(app)
    .post('/api/auth/login')
    .send({ username: 'wendell', password: 'wrong-password' });

  expect(response.status).toBe(401);
  expect(response.body.message).toBe('Invalid username or password');
});

test('returns the current user with a valid token', async () => {
  await request(app)
    .post('/api/auth/register')
    .send({ username: 'wendell', password: 'password123' });

  const login = await request(app)
    .post('/api/auth/login')
    .send({ username: 'wendell', password: 'password123' });

  const response = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${login.body.token}`);

  expect(response.status).toBe(200);
  expect(response.body.user.username).toBe('wendell');
});

test('rejects current user requests without a token', async () => {
  const response = await request(app).get('/api/auth/me');

  expect(response.status).toBe(401);
  expect(response.body.message).toBe('Missing authorization token');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test --prefix server
```

Expected: FAIL because `server/src/app.js` and related backend files do not exist yet.

- [ ] **Step 3: Create the user model**

Create `server/src/models/User.js`:

```js
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
  },
  { timestamps: true },
);

export const User = mongoose.model('User', userSchema);
```

- [ ] **Step 4: Create JWT auth middleware**

Create `server/src/middleware/auth.js`:

```js
import jwt from 'jsonwebtoken';

export function requireAuth(req, res, next) {
  const header = req.get('Authorization');

  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing authorization token' });
  }

  try {
    req.user = jwt.verify(header.slice('Bearer '.length), process.env.JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ message: 'Invalid authorization token' });
  }
}
```

- [ ] **Step 5: Create auth routes**

Create `server/src/routes/auth.js`:

```js
import bcrypt from 'bcryptjs';
import express from 'express';
import jwt from 'jsonwebtoken';
import { requireAuth } from '../middleware/auth.js';
import { User } from '../models/User.js';

export const authRouter = express.Router();

function cleanUsername(username) {
  return String(username || '').trim();
}

function signToken(user) {
  return jwt.sign(
    { id: user._id.toString(), username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: '1d' },
  );
}

authRouter.post('/register', async (req, res, next) => {
  try {
    const username = cleanUsername(req.body.username);
    const password = String(req.body.password || '');

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(409).json({ message: 'Username already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await User.create({ username, passwordHash });

    return res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    return next(error);
  }
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const username = cleanUsername(req.body.username);
    const password = String(req.body.password || '');
    const user = await User.findOne({ username });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    return res.json({
      token: signToken(user),
      user: {
        id: user._id.toString(),
        username: user.username,
      },
    });
  } catch (error) {
    return next(error);
  }
});

authRouter.get('/me', requireAuth, (req, res) => {
  return res.json({
    user: {
      id: req.user.id,
      username: req.user.username,
    },
  });
});
```

- [ ] **Step 6: Create the Express app**

Create `server/src/app.js`:

```js
import cors from 'cors';
import express from 'express';
import { authRouter } from './routes/auth.js';

export function createApp() {
  const app = express();

  app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
  app.use(express.json());

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/auth', authRouter);

  app.use((error, req, res, next) => {
    console.error(error);
    res.status(500).json({ message: 'Something went wrong' });
  });

  return app;
}
```

- [ ] **Step 7: Create database connection helper**

Create `server/src/db.js`:

```js
import mongoose from 'mongoose';

export async function connectDatabase(uri) {
  if (!uri) {
    throw new Error('MONGODB_URI is required');
  }

  await mongoose.connect(uri);
}
```

- [ ] **Step 8: Create server entry point**

Create `server/src/server.js`:

```js
import 'dotenv/config';
import { createApp } from './app.js';
import { connectDatabase } from './db.js';

const port = process.env.PORT || 5000;

await connectDatabase(process.env.MONGODB_URI);

createApp().listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
```

- [ ] **Step 9: Run backend tests to verify they pass**

Run:

```bash
npm test --prefix server
```

Expected: PASS for all backend auth tests.

## Task 3: Frontend Login And Register UI With TDD

**Files:**
- Create: `client/src/App.test.jsx`
- Create: `client/src/api.js`
- Create: `client/src/App.jsx`
- Create: `client/src/App.css`

- [ ] **Step 1: Write failing frontend tests**

Create `client/src/App.test.jsx`:

```jsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import App from './App.jsx';

beforeEach(() => {
  localStorage.clear();
  global.fetch = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

test('shows the login form by default', () => {
  render(<App />);

  expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
  expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
});

test('shows validation when login fields are empty', async () => {
  const user = userEvent.setup();
  render(<App />);

  await user.click(screen.getByRole('button', { name: /log in/i }));

  expect(screen.getByText('Username and password are required')).toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
});

test('logs in and shows the authenticated user', async () => {
  fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      token: 'abc123',
      user: { id: '1', username: 'wendell' },
    }),
  });

  const user = userEvent.setup();
  render(<App />);

  await user.type(screen.getByLabelText(/username/i), 'wendell');
  await user.type(screen.getByLabelText(/password/i), 'password123');
  await user.click(screen.getByRole('button', { name: /log in/i }));

  await waitFor(() => {
    expect(screen.getByText('You are logged in as wendell.')).toBeInTheDocument();
  });
  expect(localStorage.getItem('authToken')).toBe('abc123');
});

test('switches to register and creates an account', async () => {
  fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ message: 'User registered successfully' }),
  });

  const user = userEvent.setup();
  render(<App />);

  await user.click(screen.getByRole('button', { name: /create one/i }));
  await user.type(screen.getByLabelText(/username/i), 'newuser');
  await user.type(screen.getByLabelText(/password/i), 'password123');
  await user.click(screen.getByRole('button', { name: /create account/i }));

  await waitFor(() => {
    expect(screen.getByText('Account created. You can log in now.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test --prefix client
```

Expected: FAIL because `client/src/App.jsx`, `client/src/api.js`, or UI behavior does not exist yet.

- [ ] **Step 3: Create frontend API helper**

Create `client/src/api.js`:

```js
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Request failed');
  }

  return data;
}

export function registerUser({ username, password }) {
  return request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export function loginUser({ username, password }) {
  return request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export function getCurrentUser(token) {
  return request('/api/auth/me', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}
```

- [ ] **Step 4: Create React app component**

Create `client/src/App.jsx`:

```jsx
import { useState } from 'react';
import { loginUser, registerUser } from './api.js';

export default function App() {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isLogin = mode === 'login';

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!username.trim() || !password) {
      setError('Username and password are required');
      return;
    }

    setIsSubmitting(true);

    try {
      if (isLogin) {
        const data = await loginUser({ username, password });
        localStorage.setItem('authToken', data.token);
        setUser(data.user);
      } else {
        await registerUser({ username, password });
        setMode('login');
        setPassword('');
        setMessage('Account created. You can log in now.');
      }
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem('authToken');
    setUser(null);
    setUsername('');
    setPassword('');
    setMessage('');
    setError('');
  }

  if (user) {
    return (
      <main className="page-shell">
        <section className="auth-card success-card">
          <p className="eyebrow">Dashboard</p>
          <h1>Welcome, {user.username}</h1>
          <p>You are logged in as {user.username}.</p>
          <button type="button" onClick={handleLogout}>
            Log out
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <section className="auth-card">
        <p className="eyebrow">CJN Studio</p>
        <h1>{isLogin ? 'Welcome back' : 'Create your account'}</h1>
        <p className="subtitle">
          {isLogin ? 'Log in to continue to your workspace.' : 'Start with a username and secure password.'}
        </p>

        <form onSubmit={handleSubmit}>
          <label htmlFor="username">Username</label>
          <input
            id="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Enter your username"
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
          />

          {error && <p className="form-error">{error}</p>}
          {message && <p className="form-success">{message}</p>}

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Please wait...' : isLogin ? 'Log in' : 'Create account'}
          </button>
        </form>

        <p className="switch-text">
          {isLogin ? "Don't have an account?" : 'Already have an account?'}
          <button
            type="button"
            className="link-button"
            onClick={() => {
              setMode(isLogin ? 'register' : 'login');
              setError('');
              setMessage('');
            }}
          >
            {isLogin ? 'Create one' : 'Log in'}
          </button>
        </p>
      </section>
    </main>
  );
}
```

- [ ] **Step 5: Create Wix-style CSS**

Create `client/src/App.css`:

```css
:root {
  color: #1f2937;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: #f6f0ff;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
}

button,
input {
  font: inherit;
}

.page-shell {
  align-items: center;
  background:
    radial-gradient(circle at top left, rgba(116, 67, 255, 0.22), transparent 34rem),
    linear-gradient(135deg, #f8f4ff 0%, #fff7fb 52%, #eef7ff 100%);
  display: flex;
  min-height: 100vh;
  justify-content: center;
  padding: 2rem;
}

.auth-card {
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.75);
  border-radius: 28px;
  box-shadow: 0 24px 80px rgba(79, 70, 229, 0.18);
  max-width: 430px;
  padding: 2.5rem;
  width: 100%;
}

.eyebrow {
  color: #6d28d9;
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.16em;
  margin: 0 0 0.75rem;
  text-transform: uppercase;
}

h1 {
  color: #111827;
  font-size: clamp(2rem, 5vw, 2.65rem);
  line-height: 1;
  margin: 0;
}

.subtitle {
  color: #6b7280;
  margin: 0.9rem 0 2rem;
}

form {
  display: grid;
  gap: 0.8rem;
}

label {
  color: #374151;
  font-size: 0.92rem;
  font-weight: 700;
}

input {
  border: 1px solid #d8d6f5;
  border-radius: 14px;
  padding: 0.9rem 1rem;
}

input:focus {
  border-color: #7c3aed;
  box-shadow: 0 0 0 4px rgba(124, 58, 237, 0.12);
  outline: none;
}

button {
  background: #111827;
  border: 0;
  border-radius: 999px;
  color: #fff;
  cursor: pointer;
  font-weight: 800;
  margin-top: 0.55rem;
  padding: 0.95rem 1.2rem;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.form-error,
.form-success {
  border-radius: 12px;
  margin: 0.25rem 0;
  padding: 0.8rem;
}

.form-error {
  background: #fef2f2;
  color: #b91c1c;
}

.form-success {
  background: #ecfdf5;
  color: #047857;
}

.switch-text {
  color: #6b7280;
  margin: 1.25rem 0 0;
  text-align: center;
}

.link-button {
  background: transparent;
  color: #6d28d9;
  margin: 0 0 0 0.35rem;
  padding: 0;
}

.success-card {
  text-align: center;
}
```

- [ ] **Step 6: Run frontend tests to verify they pass**

Run:

```bash
npm test --prefix client
```

Expected: PASS for all frontend tests.

## Task 4: Full Verification And Local Run

**Files:**
- Modify only if verification exposes a mismatch in files from Tasks 1-3.

- [ ] **Step 1: Run all tests**

Run:

```bash
npm test
```

Expected: backend and frontend test suites both pass.

- [ ] **Step 2: Configure local backend env**

Create `server/.env` locally, without committing it:

```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/wix_login
JWT_SECRET=local-development-secret
CLIENT_ORIGIN=http://localhost:5173
```

- [ ] **Step 3: Start MongoDB**

Run MongoDB locally or use a MongoDB Atlas connection string in `server/.env`.

Expected: `MONGODB_URI` points to a reachable MongoDB database.

- [ ] **Step 4: Start backend**

Run:

```bash
npm run dev:server
```

Expected: `Server running on http://localhost:5000`.

- [ ] **Step 5: Start frontend in a second terminal**

Run:

```bash
npm run dev:client
```

Expected: Vite prints a local URL, usually `http://localhost:5173`.

- [ ] **Step 6: Manually verify the auth flow**

Open the frontend URL and verify:

- Register a new username and password.
- Log in with the new credentials.
- See `You are logged in as <username>.`
- Log out.
- Try an incorrect password and see an error message.

## Self-Review

- Spec coverage: The plan covers the React frontend, Node/Express backend, MongoDB user model, bcrypt password hashing, JWT auth, `/register`, `/login`, `/me`, error states, and tests.
- Placeholder scan: No unresolved placeholders are present.
- Type consistency: The plan consistently uses `username`, `password`, `passwordHash`, `token`, and `user`.
- Scope check: The app is a single small authentication project and does not need to be split into separate specs.
