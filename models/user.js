const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  userId: Number,
  name: String,
  balance: { type: Number, default: 0 },
  banned: { type: Boolean, default: false }
});

module.exports = mongoose.model("User", userSchema);
