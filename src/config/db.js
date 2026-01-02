import mongoose from "mongoose";

export const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      console.error("FATAL ERROR: MONGO_URI is not defined in the .env file.");
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log("MongoDB connected ✅");
  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1); // Exit process with failure
  }
};

export const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    console.log("MongoDB disconnected ❌");
  } catch (err) {
    console.error("Error disconnecting from MongoDB:", err.message);
  }
};
