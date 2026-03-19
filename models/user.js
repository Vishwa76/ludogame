import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  
  telegramId: {
    type: Number,
    required: true,
    unique: true
  },
  username: {
    type: String,
    default: null
  },
  firstName: {
    type: String,
    default: "Player"
  },
  balance: {
    type: Number,
    default: 0
  }
})



export default  mongoose.model("User", userSchema);
