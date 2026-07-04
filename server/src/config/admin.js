export const adminUsername = String(process.env.ADMIN_USERNAME || 'dellmonti1106').trim().toLowerCase();

export function isAdminUser(user) {
  if (!user) {
    return false;
  }

  return user.isAdmin === true || String(user.username || '').trim().toLowerCase() === adminUsername;
}

export function validateAdminRegistrationPassword(adminPassword) {
  const expectedPassword = process.env.ADMIN_REGISTRATION_PASSWORD;

  if (!expectedPassword) {
    return 'Registration is unavailable because the administration password is not configured';
  }

  if (!adminPassword) {
    return 'Administration password is required to create an account';
  }

  if (adminPassword !== expectedPassword) {
    return 'Invalid administration password';
  }

  return null;
}
