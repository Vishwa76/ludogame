import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

export const BOT_TOKEN = process.env.BOT_TOKEN;
export const PROVIDER_TOKEN = process.env.PROVIDER_TOKEN;

export const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB Connected");
  } catch (err) {
    console.log("DB Error:", err.message);
    process.exit(1);
  }
};

