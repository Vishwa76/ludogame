import mongoose from "mongoose";

const matchSchema = new mongoose.Schema({
  player1: Number,
  player2: Number,
  balance: Number,
  tableNumber: Number,   // ✅ required
  chatId: Number, 
  status: { type: String, default: "active" }
});

export default mongoose.model("Match", matchSchema);