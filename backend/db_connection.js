import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config({ path: './atlas-credentials.env' });

export async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, { dbName: 'bidmaxxer' });
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  }
}