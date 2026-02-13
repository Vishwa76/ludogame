const mongoose = require("mongoose");

const tableSchema = new mongoose.Schema({
  tableId: String,
  userId: Number,
  amount: Number,
  type: String,
  game: Number,
  options: [String],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Table", tableSchema);
