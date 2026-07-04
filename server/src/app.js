import cors from 'cors';
import express from 'express';
import { createApplicantsRouter } from './routes/applicants.js';
import { createAuthRouter } from './routes/auth.js';

export function createApp({ userModel, applicantModel } = {}) {
  const app = express();

  const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error(`Origin ${origin} is not allowed by CORS`));
      },
    }),
  );
  app.use(express.json({ limit: '8mb' }));

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/auth', createAuthRouter(userModel));
  app.use('/api/applicants', createApplicantsRouter(applicantModel));

  app.use((error, req, res, next) => {
    console.error(error);

    if (
      error.name === 'MongoServerError' ||
      error.codeName === 'AtlasError' ||
      String(error.message).includes('bad auth')
    ) {
      return res.status(503).json({
        message:
          'Database connection failed. The MongoDB password in MONGODB_URI is incorrect or outdated. Update server/.env and Render, then restart the server.',
      });
    }

    if (String(error.message).includes('MONGODB_URI')) {
      return res.status(503).json({ message: error.message });
    }

    res.status(500).json({ message: 'Something went wrong' });
  });

  return app;
}
