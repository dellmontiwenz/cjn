import bcrypt from 'bcryptjs';
import express from 'express';
import jwt from 'jsonwebtoken';
import { adminUsername, isAdminUser, validateAdminRegistrationPassword } from '../config/admin.js';
import { requireAuth } from '../middleware/auth.js';
import { User } from '../models/User.js';

function cleanUsername(username) {
  return String(username || '').trim();
}

function serializeUser(user) {
  return {
    id: user.id || user._id?.toString(),
    username: user.username,
    isAdmin: isAdminUser(user),
  };
}

function signToken(user) {
  return jwt.sign(
    {
      id: user._id.toString(),
      username: user.username,
      isAdmin: isAdminUser(user),
    },
    process.env.JWT_SECRET,
    { expiresIn: '1d' },
  );
}

export function createAuthRouter(userModel = User) {
  const authRouter = express.Router();

  authRouter.post('/register', async (req, res, next) => {
    try {
      const username = cleanUsername(req.body.username);
      const password = String(req.body.password || '');
      const adminPassword = String(req.body.adminPassword || '');

      if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
      }

      const adminPasswordError = validateAdminRegistrationPassword(adminPassword);
      if (adminPasswordError) {
        const status = adminPasswordError.includes('not configured') ? 503 : adminPasswordError.includes('Invalid') ? 403 : 400;
        return res.status(status).json({ message: adminPasswordError });
      }

      const existingUser = await userModel.findOne({ username });
      if (existingUser) {
        return res.status(409).json({ message: 'Username already exists' });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      await userModel.create({
        username,
        passwordHash,
        isAdmin: username.toLowerCase() === adminUsername,
      });

      return res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
      return next(error);
    }
  });

  authRouter.post('/login', async (req, res, next) => {
    try {
      const username = cleanUsername(req.body.username);
      const password = String(req.body.password || '');
      const user = await userModel.findOne({ username });

      if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
        return res.status(401).json({ message: 'Invalid username or password' });
      }

      return res.json({
        token: signToken(user),
        user: serializeUser(user),
      });
    } catch (error) {
      return next(error);
    }
  });

  authRouter.get('/me', requireAuth, (req, res) => {
    return res.json({
      user: serializeUser(req.user),
    });
  });

  return authRouter;
}

export const authRouter = createAuthRouter();
