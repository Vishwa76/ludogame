import mongoose from "mongoose";

const queueSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true },
  username: String,
  firstName: String,
  balance: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
});

queueSchema.index({ balance: 1 });
queueSchema.index({ telegramId: 1 }, { unique: true });

export default mongoose.model("Queue", queueSchema);