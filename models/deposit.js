import mongoose from "mongoose";

const depositSchema = new mongoose.Schema({
  telegramId: Number,
  username:String,
  amount: Number,
  status: { type: String, default: "pending" },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("Deposit", depositSchema);