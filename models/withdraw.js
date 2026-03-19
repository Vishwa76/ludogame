// models/Withdraw.js
import mongoose from "mongoose";

const withdrawSchema = new mongoose.Schema({
  userId: Number,
  username:String,
  amount: Number,
  status: { type: String, default: "pending" }, // pending, approved, rejected
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("Withdraw", withdrawSchema);