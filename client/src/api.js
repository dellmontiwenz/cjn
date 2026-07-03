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
