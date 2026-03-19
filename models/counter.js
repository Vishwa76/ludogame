import mongoose from "mongoose";

const counterSchema = new mongoose.Schema({
  name: String,
  value: { type: Number, default: 1 }
});

export default mongoose.model("Counter", counterSchema);