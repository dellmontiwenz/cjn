import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import App from './App.jsx';

beforeEach(() => {
  localStorage.clear();
  global.fetch = vi.fn();
});

afterEach(() => {
  cleanup();
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
