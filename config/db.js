const mongoose = require("mongoose");
let connectionPromise;

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) return true;
  if (connectionPromise) return connectionPromise;
  if (!process.env.MONGO_URI) {
    console.error("MongoDB connection error: MONGO_URI is not configured");
    return false;
  }

  connectionPromise = (async () => {
    try {
      await mongoose.connect(process.env.MONGO_URI, {
        serverSelectionTimeoutMS: 8000,
        connectTimeoutMS: 8000,
      });
      return true;
    } catch (error) {
      // Log the error category without exposing connection credentials.
      console.error(`MongoDB connection failed (${error.name || "Error"})`);
      return false;
    }
  })();
  try {
    return await connectionPromise;
  } finally {
    connectionPromise = undefined;
  }
};

module.exports = connectDB;
