/**
 * MongoDB connection configuration using Mongoose.
 */

const mongoose = require('mongoose');

const MONGODB_URL = process.env.MONGODB_URL || 'mongodb://localhost:27017/opd_claims';

async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URL);
    console.log('✅ Connected to MongoDB:', mongoose.connection.name);
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    console.error('   Make sure MongoDB is running locally or set MONGODB_URL to Atlas URI');
    process.exit(1);
  }

  mongoose.connection.on('error', (err) => {
    console.error('MongoDB error:', err);
  });

  mongoose.connection.on('disconnected', () => {
    console.log('🔌 MongoDB disconnected');
  });
}

module.exports = { connectDB };
