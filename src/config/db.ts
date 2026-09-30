import mongoose from 'mongoose';
import dns from 'dns';

// Ensure DNS SRV resolution works across all Windows network environments
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  console.warn('DNS server override not supported, proceeding with default DNS');
}

export const connectDB = async (): Promise<void> => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('MongoDB Connected Successfully to:', mongoose.connection.name || 'database');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

