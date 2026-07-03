# Wix-Style Login App Design

## Goal

Build a simple full-stack authentication app with a polished Wix-like login page. Users can register with a username and password, then log in using those credentials. User data is saved in MongoDB through a Node.js backend, while the frontend is built with React.

## Recommended Stack

- Frontend: React with Vite
- Backend: Node.js with Express
- Database: MongoDB with Mongoose
- Password security: bcrypt password hashing
- Session/auth state: JSON Web Tokens
- Development layout: separate `client` and `server` folders

## User Experience

The login screen will use a clean, centered card layout similar to common Wix login pages:

- Full-page soft background
- Centered white login card
- App title or logo text at the top
- Username input
- Password input
- Primary login button
- Secondary link to create an account
- Inline error messages for failed login or validation issues
- Success state after login, showing the logged-in username

The register screen can use the same visual style so the app feels consistent.

## Architecture

The project will be structured as:

```text
client/
  React app, login/register UI, API calls

server/
  Express app, auth routes, MongoDB connection, user model
```

The frontend talks to the backend over HTTP. The backend validates input, hashes passwords before saving them, verifies passwords during login, and returns a JWT when credentials are valid.

## Backend API

The backend will provide these routes:

- `POST /api/auth/register`
  - Accepts `username` and `password`
  - Rejects missing fields and duplicate usernames
  - Hashes the password with bcrypt
  - Saves the user in MongoDB
  - Returns a success message

- `POST /api/auth/login`
  - Accepts `username` and `password`
  - Finds the user by username
  - Compares the submitted password with the stored bcrypt hash
  - Returns a JWT and basic user data on success

- `GET /api/auth/me`
  - Requires a valid JWT
  - Returns the current user's id and username

## MongoDB User Model

Users will be stored with this shape:

```js
{
  username: String,
  passwordHash: String,
  createdAt: Date,
  updatedAt: Date
}
```

The username will be unique. Plain text passwords will never be stored.

## Error Handling

The app will handle:

- Empty username or password
- Duplicate username on registration
- Invalid username or password on login
- Backend connection errors
- Missing or invalid JWT token

Frontend errors will appear near the form so users know what to fix.

## Security Decisions

- Store only bcrypt password hashes
- Keep MongoDB connection string and JWT secret in `.env`
- Never commit `.env`
- Use JWT for authenticated requests
- Keep validation simple and explicit for this first version

## Testing Plan

Backend tests should cover:

- Successful registration
- Duplicate username rejection
- Successful login
- Invalid password rejection
- Protected `/api/auth/me` route with and without a valid token

Frontend tests should cover:

- Rendering login/register forms
- Showing validation errors
- Sending login/register requests
- Showing authenticated user state after successful login

## Implementation Notes

The first version should stay intentionally small:

- No email verification
- No password reset
- No roles or admin panel
- No third-party login

Those features can be added later once the basic auth flow is working.
