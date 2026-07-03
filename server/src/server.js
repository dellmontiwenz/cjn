import 'dotenv/config';
import { createApp } from './app.js';
import { connectDatabase } from './db.js';

const port = process.env.PORT || 5000;

await connectDatabase(process.env.MONGODB_URI);

createApp().listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
