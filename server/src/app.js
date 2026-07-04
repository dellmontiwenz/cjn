import cors from 'cors';
import express from 'express';
import { createApplicantsRouter } from './routes/applicants.js';
import { createAuthRouter } from './routes/auth.js';

export function createApp({ userModel, applicantModel } = {}) {
  const app = express();

  app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
  app.use(express.json());

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/auth', createAuthRouter(userModel));
  app.use('/api/applicants', createApplicantsRouter(applicantModel));

  app.use((error, req, res, next) => {
    console.error(error);
    res.status(500).json({ message: 'Something went wrong' });
  });

  return app;
}
