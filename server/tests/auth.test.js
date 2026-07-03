import request from 'supertest';
import { createApp } from '../src/app.js';

let User;
let app;

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

beforeEach(() => {
  process.env.JWT_SECRET = 'test-secret';
  User = createMemoryUserModel();
  app = createApp({ userModel: User });
});

afterEach(async () => {
  await User.deleteMany({});
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
