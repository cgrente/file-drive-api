// src/config/db.config.ts
import mongoose from "mongoose";
import { requireEnv, getEnv } from "./env";
import { setMongoReady } from "../infra/deps";

/**
 * Connect to MongoDB
 */
const connectDB = async (): Promise<void> => {
  const baseUri = requireEnv("MONGO_URI");
  const dbName = getEnv("DB_NAME");

  const mongoUri = dbName
    ? `${baseUri.replace(/\/$/, "")}/${dbName}`
    : baseUri;
  // Track readiness (handles reconnect/disconnect)
  mongoose.connection.on("connected", () => setMongoReady(true));
  mongoose.connection.on("disconnected", () => setMongoReady(false));
  mongoose.connection.on("error", () => setMongoReady(false));

  try {
    mongoose.set("strictQuery", true);
    mongoose.set("sanitizeFilter", true);

    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10_000,
      connectTimeoutMS: 10_000,
    });
    console.log("✅ MongoDB connected");
  } catch (error) {
    setMongoReady(false);
    console.error("❌ MongoDB connection error:", error);
    throw error;
  }
};

export default connectDB;