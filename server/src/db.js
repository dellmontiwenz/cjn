import mongoose from 'mongoose';

export async function connectDatabase(uri) {
  if (!uri) {
    throw new Error('MONGODB_URI is required');
  }

  try {
    await mongoose.connect(uri);
  } catch (error) {
    if (error.codeName === 'AtlasError' || String(error.message).includes('bad auth')) {
      throw new Error(
        'MongoDB authentication failed. Update MONGODB_URI in server/.env (and on Render) with your current Atlas password.',
      );
    }

    throw error;
  }
}
