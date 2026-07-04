import request from 'supertest';
import { createApp } from '../src/app.js';

let User;
let app;

const adminRegistrationPassword = 'admin-secret-123';

function createMemoryUserModel() {
  const users = [];

  return {
    async deleteMany() {
      users.length = 0;
    },
    async findOne({ username }) {
      return users.find((user) => user.username === username) || null;
    },
    async create(data) {
      const user = {
        _id: { toString: () => String(users.length + 1) },
        ...data,
      };
      users.push(user);
      return user;
    },
  };
}

function registerUser(username, password, adminPassword = adminRegistrationPassword) {
  return request(app)
    .post('/api/auth/register')
    .send({ username, password, adminPassword });
}

beforeEach(() => {
  process.env.JWT_SECRET = 'test-secret';
  process.env.ADMIN_REGISTRATION_PASSWORD = adminRegistrationPassword;
  User = createMemoryUserModel();
  app = createApp({ userModel: User });
});

afterEach(async () => {
  await User.deleteMany({});
});

test('registers a new user without storing the plain password', async () => {
  const response = await registerUser('wendell', 'password123');

  expect(response.status).toBe(201);
  expect(response.body.message).toBe('User registered successfully');

  const user = await User.findOne({ username: 'wendell' });
  expect(user).not.toBeNull();
  expect(user.passwordHash).not.toBe('password123');
  expect(user.isAdmin).toBe(false);
});

test('registers dellmonti1106 as an admin user', async () => {
  const response = await registerUser('dellmonti1106', 'password123');

  expect(response.status).toBe(201);

  const user = await User.findOne({ username: 'dellmonti1106' });
  expect(user.isAdmin).toBe(true);
});

test('rejects registration without an administration password', async () => {
  const response = await request(app)
    .post('/api/auth/register')
    .send({ username: 'wendell', password: 'password123' });

  expect(response.status).toBe(400);
  expect(response.body.message).toBe('Administration password is required to create an account');
});

test('rejects registration with an invalid administration password', async () => {
  const response = await registerUser('wendell', 'password123', 'wrong-admin-password');

  expect(response.status).toBe(403);
  expect(response.body.message).toBe('Invalid administration password');
});

test('rejects duplicate usernames', async () => {
  await registerUser('wendell', 'password123');

  const response = await registerUser('wendell', 'password123');

  expect(response.status).toBe(409);
  expect(response.body.message).toBe('Username already exists');
});

test('logs in with valid credentials and returns a token', async () => {
  await registerUser('wendell', 'password123');

  const response = await request(app)
    .post('/api/auth/login')
    .send({ username: 'wendell', password: 'password123' });

  expect(response.status).toBe(200);
  expect(response.body.token).toEqual(expect.any(String));
  expect(response.body.user.username).toBe('wendell');
  expect(response.body.user.isAdmin).toBe(false);
});

test('returns admin status when dellmonti1106 logs in', async () => {
  await registerUser('dellmonti1106', 'password123');

  const response = await request(app)
    .post('/api/auth/login')
    .send({ username: 'dellmonti1106', password: 'password123' });

  expect(response.status).toBe(200);
  expect(response.body.user.isAdmin).toBe(true);
});

test('rejects invalid login credentials', async () => {
  await registerUser('wendell', 'password123');

  const response = await request(app)
    .post('/api/auth/login')
    .send({ username: 'wendell', password: 'wrong-password' });

  expect(response.status).toBe(401);
  expect(response.body.message).toBe('Invalid username or password');
});

test('returns the current user with a valid token', async () => {
  await registerUser('wendell', 'password123');

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
