import mongoose from 'mongoose';

const defaultDatabaseName = 'wix_login';

export async function connectDatabase(uri) {
  if (!uri) {
    throw new Error('MONGODB_URI is required');
  }

  const dbName = process.env.MONGODB_DB_NAME || defaultDatabaseName;

  try {
    await mongoose.connect(uri, { dbName });
  } catch (error) {
    if (error.codeName === 'AtlasError' || String(error.message).includes('bad auth')) {
      throw new Error(
        'MongoDB authentication failed. Update MONGODB_URI in server/.env (and on Render) with your current Atlas password.',
      );
    }

    throw error;
  }
}
