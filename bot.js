
import TelegramBot from "node-telegram-bot-api";
import { connectDB, BOT_TOKEN} from "./config.js";
import mongoose from "mongoose";
import User from "./models/user.js";
import Queue from "./models/queue.js";
import Match from "./models/match.js";
import Deposit from "./models/deposit.js";
import Counter from "./models/counter.js";
import Withdraw from "./models/withdraw.js";
const userState = {};

// block unknown commands


process.on("uncaughtException", (err) => {
  console.error("🔥 Uncaught Exception:", err);
});

process.on("unhandledRejection", (err) => {
  console.error("🔥 Unhandled Rejection:", err);
});

async function getNextTableNumber() {
  const counter = await Counter.findOneAndUpdate(
    { name: "table" },
    { $inc: { value: 1 } },
    { new: true, upsert: true }
  );

  return counter.value;
}
 const GROUP_ID = -1003867198148 ;
connectDB();

 const bot = new TelegramBot(BOT_TOKEN, {
  polling: {
    interval: 300,
    autoStart: true,
    params: {
      timeout: 10
    }
  }
});

console.log("🤖 Bot Running...");
bot.on("polling_error", (err) => {
  console.log("FULL ERROR:", err);
});

function sendMainMenu(chatId) {
  bot.sendMessage(chatId, "🏠 Main Menu", {
    reply_markup: {
      keyboard: [
  ["🎮 Play", "💰 Balance"],
  ["💸 Withdraw", "💳 Deposit"]
],
      resize_keyboard: true
    }
  });
}
// ================= START =================
bot.onText(/\/start/, async (msg) => {

  const telegramId = msg.from.id;

    let user = await User.findOneAndUpdate(
    { telegramId },
    {
      telegramId,
      username: msg.from.username || null,
      firstName: msg.from.first_name || "Player"
    },
    { upsert: true }
  );

  if (!user) {
    await User.create({ telegramId, balance: 0 });
  }

  bot.sendMessage(msg.chat.id,
    `✅ Wallet created!\nYour ID: ${telegramId}`
  );

  sendMainMenu(msg.chat.id);
});

async function handlePlay(telegramId, chatId, amount, msg) {
  try {

    if (amount <= 0) {
      return bot.sendMessage(chatId, "❌ Invalid amount.");
    }

    const user = await User.findOne({ telegramId });

    if (!user || user.balance < amount) {
      return bot.sendMessage(chatId, "❌ Insufficient balance.");
    }

    const alreadyQueued = await Queue.findOne({ telegramId });
    if (alreadyQueued) {
      return bot.sendMessage(chatId, "⏳ Already waiting for match...");
    }

    const opponent = await Queue.findOneAndDelete({
      telegramId: { $ne: telegramId },
      balance: amount
    });

    if (opponent) {

      await User.updateOne(
        { telegramId },
        { $inc: { balance: -amount } }
      );

      await User.updateOne(
        { telegramId: opponent.telegramId },
        { $inc: { balance: -amount } }
      );

      const tableNumber = await getNextTableNumber();

      const matchData = await Match.create({
        player1: opponent.telegramId,
        player2: telegramId,
        balance: amount,
        tableNumber,
        chatId: GROUP_ID,
        status: "active"
      });

      const p1 = opponent.username
        ? `@${opponent.username}`
        : opponent.firstName || "Player";

      const p2 = msg.from.username
        ? `@${msg.from.username}`
        : msg.from.first_name || "Player";

      const matchMessage = `
🏆 <b>MATCH CONFIRMED!</b>

${p1} 🆚 ${p2}

💰 Entry: ₹${amount}
🏆 Prize Pool: ₹${amount * 2}
🎮 Table #${tableNumber}
`;

      bot.sendMessage(chatId, matchMessage, { parse_mode: "HTML" });
      bot.sendMessage(opponent.telegramId, matchMessage, { parse_mode: "HTML" });
      bot.sendMessage(GROUP_ID, matchMessage, { parse_mode: "HTML" });

    } else {

      await Queue.create({
        telegramId,
        username: msg.from.username || null,
        firstName: msg.from.first_name || "Player",
        balance: amount
      });

      bot.sendMessage(chatId, `⏳ Waiting for player for ₹${amount} match...`);
    }

  } catch (error) {
    console.log("PLAY ERROR:", error);
  }
}

bot.onText(/\/play (\d+)/, async (msg, match) => {
  const amount = parseInt(match[1]);
  const telegramId = msg.from.id;
  const chatId = msg.chat.id;

  await handlePlay(telegramId, chatId, amount, msg);
});

const ADMIN_ID = process.env.ADMIN_ID; // your telegram id


async function handleDeposit(userId, chatId, amount, msg) {
  try {

    if (!amount || amount <= 0) {
      return bot.sendMessage(chatId, "❌ Invalid amount");
    }

    const deposit = await Deposit.create({
      telegramId: userId,
      username: msg.from.username || null,
      amount
    });

    const displayName = msg.from.username
      ? `@${msg.from.username}`
      : `<a href="tg://user?id=${userId}">
          ${msg.from.first_name || "Player"}
        </a>`;

    // message to admin
    bot.sendMessage(
      ADMIN_ID,
      `📥 <b>Deposit Request</b>

👤 User: ${displayName}
🆔 ID: ${userId}
💰 Amount: ₹${amount}

⚡️ Approve:
/approve ${msg.from.username ? "@" + msg.from.username : userId}`,
      { parse_mode: "HTML" }
    );

    // message to user
    bot.sendMessage(
      chatId,
      `✅ Deposit request sent!\n💰 Amount: ₹${amount}\n📸 Send payment screenshot to admin`
    );

  } catch (err) {
    console.error("DEPOSIT ERROR:", err);
    bot.sendMessage(chatId, "⚠️ Error processing deposit");
  }
}

bot.onText(/\/deposit (\d+)/, async (msg, match) => {
  const amount = parseInt(match[1]);
  const userId = msg.from.id;
  const chatId = msg.chat.id;

  await handleDeposit(userId, chatId, amount, msg);
});

bot.onText(/\/approve (.+)/, async (msg, match) => {

  if (msg.from.id !== ADMIN_ID) {
    return bot.sendMessage(msg.chat.id, "❌ Not authorized");
  }

  let input = match[1].trim();

  let deposit;

  if (input.startsWith("@")) {
    const username = input.replace("@", "");

    deposit = await Deposit.findOne({
      username,
      status: "pending"
    }).sort({ createdAt: -1 });

  } else {
    const telegramId = parseInt(input);

    deposit = await Deposit.findOne({
      telegramId,
      status: "pending"
    }).sort({ createdAt: -1 });
  }

  if (!deposit) {
    return bot.sendMessage(msg.chat.id, "❌ No pending deposit found.");
  }

  await User.updateOne(
    { telegramId: deposit.telegramId },
    { $inc: { balance: deposit.amount } }
  );

  deposit.status = "approved";
  await deposit.save();

  bot.sendMessage(deposit.telegramId,
    `💰 ₹${deposit.amount} added to your wallet successfully!`
  );

  bot.sendMessage(msg.chat.id, "✅ Deposit approved.");
});

async function handleWithdraw(userId, chatId, amount, msg) {
  try {

    if (!amount || amount <= 0) {
      return bot.sendMessage(chatId, "❌ Invalid amount");
    }

    const user = await User.findOne({ telegramId: userId });

    if (!user || user.balance < amount) {
      return bot.sendMessage(chatId, "❌ Insufficient balance");
    }

    const withdraw = await Withdraw.create({
      userId,
      username: msg.from.username || null,
      name: msg.from.first_name || "Player",
      amount
    });

    const displayName = withdraw.username
      ? `@${withdraw.username}`
      : `<a href="tg://user?id=${withdraw.userId}">
          ${withdraw.name || "Player"}
        </a>`;

    // send to admin
    bot.sendMessage(
      ADMIN_ID,
      `💸 <b>Withdraw Request</b>

👤 User: ${displayName}
🆔 ID: ${withdraw.userId}
💰 Amount: ₹${amount}

⚡️ Approve:
/approve_withdraw ${withdraw._id}

❌ Reject:
/reject ${withdraw._id}`,
      { parse_mode: "HTML" }
    );

    // confirm to user
    bot.sendMessage(chatId, "✅ Withdraw request sent to admin");

  } catch (err) {
    console.error("WITHDRAW ERROR:", err);
    bot.sendMessage(chatId, "⚠️ Error processing withdraw");
  }
}
bot.onText(/\/withdraw (\d+)/, async (msg, match) => {
  const amount = parseInt(match[1]);
  const userId = msg.from.id;
  const chatId = msg.chat.id;

  await handleWithdraw(userId, chatId, amount, msg);
});

bot.onText(/\/wallet/, async (msg) => {
  try {
    const telegramId = msg.from.id;

    const user = await User.findOne({ telegramId });

    if (!user) {
      return bot.sendMessage(msg.chat.id,
        "❌ Wallet not found. Use /start first."
      );
    }

    const walletMessage = `
💰 <b>Your Wallet</b>

👤 Name: ${msg.from.first_name}
🆔 ID: <code>${telegramId}</code>

💵 Available Balance: <b>₹${user.balance}</b>
`;

    bot.sendMessage(msg.chat.id, walletMessage, {
      parse_mode: "HTML"
    });

  } catch (error) {
    console.log("WALLET ERROR:", error);
  }
});

bot.onText(/\/cancel (\d+)/, async (msg, match) => {
  try {

    if (msg.from.id !== ADMIN_ID) {
      return bot.sendMessage(msg.chat.id, "❌ Not authorized");
    }

    const tableNumber = parseInt(match[1]);

    const foundMatch = await Match.findOne({
      tableNumber,
      status: "active"
    });

    if (!foundMatch) {
      return bot.sendMessage(msg.chat.id, "❌ Match not found");
    }

    const refundAmount = foundMatch.balance;

    // refund both players
    await User.updateOne(
      { telegramId: foundMatch.player1 },
      { $inc: { balance: refundAmount } }
    );

    await User.updateOne(
      { telegramId: foundMatch.player2 },
      { $inc: { balance: refundAmount } }
    );

    foundMatch.status = "cancelled";
    await foundMatch.save();

    const cancelMessage = `
❌ <b>Match Cancelled</b>

🎮 Table: #${tableNumber}
💰 Refund: ₹${refundAmount} (each player)
`;

    // send to group
    bot.sendMessage(
      foundMatch.chatId || GROUP_ID,
      cancelMessage,
      { parse_mode: "HTML" }
    );

    // notify players
    bot.sendMessage(foundMatch.player1, "❌ Match cancelled. Amount refunded.");
    bot.sendMessage(foundMatch.player2, "❌ Match cancelled. Amount refunded.");

    bot.sendMessage(msg.chat.id, "✅ Match cancelled");

  } catch (err) {
    console.error("CANCEL ERROR:", err);
    bot.sendMessage(msg.chat.id, "⚠️ Error cancelling match");
  }
});


bot.onText(/\/approve_withdraw (.+)/, async (msg, match) => {

  if (msg.from.id !== ADMIN_ID) {
    return bot.sendMessage(msg.chat.id, "❌ Not authorized");
  }

  try {
    const withdrawId = match[1].trim();
    if (!mongoose.Types.ObjectId.isValid(withdrawId)) {
      return bot.sendMessage(msg.chat.id, "❌ Invalid withdraw ID");
    }


    const withdraw = await Withdraw.findById(withdrawId);

    if (!withdraw || withdraw.status !== "pending") {
      return bot.sendMessage(msg.chat.id, "❌ Invalid request");
    }

    const user = await User.findOne({ telegramId: withdraw.userId });

    if (!user || user.balance < withdraw.amount) {
      return bot.sendMessage(msg.chat.id, "❌ User has insufficient balance");
    }

    // deduct balance
    user.balance -= withdraw.amount;
    await user.save();

    withdraw.status = "approved";
    await withdraw.save();

    const displayName = withdraw.username
      ? `@${withdraw.username}`
      : withdraw.name;

    // notify user
    bot.sendMessage(
      withdraw.userId,
      `✅ Withdraw Approved\nAmount: ₹${withdraw.amount}`
    );

    // notify admin
    bot.sendMessage(
      msg.chat.id,
      `✅ Approved

👤 User: ${displayName}
💰 Amount: ₹${withdraw.amount}`
    );

    //bot.sendMessage(msg.chat.id, "✅ Withdraw approved");

  } catch (err) {
    console.error(err);
    bot.sendMessage(msg.chat.id, "⚠️ Error approving withdraw");
  }
});
bot.onText(/\/reject (.+)/, async (msg, match) => {

  if (msg.from.id !== ADMIN_ID) return;

  const withdraw = await Withdraw.findById(match[1]);

  if (!withdraw) return;

  withdraw.status = "rejected";
  await withdraw.save();

  bot.sendMessage(withdraw.userId, "❌ Withdraw rejected");
});

 
bot.onText(/\/result (\d+) @?(\w+)/, async (msg, match) => {
  try {

    if (msg.from.id !== ADMIN_ID) {
      return bot.sendMessage(msg.chat.id, "❌ Not authorized");
    }

    if (!match) {
      return bot.sendMessage(
        msg.chat.id,
        "❌ Wrong format\n/result TABLE_NO @username"
      );
    }

    const tableNumber = parseInt(match[1]);
    const usernameInput = match[2];

    // 🔍 find match using table number
    const foundMatch = await Match.findOne({
      tableNumber,
      status: "active"
    });

    if (!foundMatch) {
      return bot.sendMessage(msg.chat.id, "❌ Match not found");
    }

    // 🔍 find winner using username
    const winner = await User.findOne({
      username: usernameInput
    });

    if (!winner) {
      return bot.sendMessage(msg.chat.id, "❌ User not found");
    }

    // 🔒 check if winner is part of match
    if (
      winner.telegramId !== foundMatch.player1 &&
      winner.telegramId !== foundMatch.player2
    ) {
      return bot.sendMessage(msg.chat.id, "❌ User not in this match");
    }

    const prize = foundMatch.balance * 2;
    const actualWinning = prize*0.96;

    await User.updateOne(
      { telegramId: winner.telegramId },
      { $inc: { balance: actualWinning } }
    );

    foundMatch.status = "completed";
    await foundMatch.save();

    // 🔥 clean display (same style as /play)
    const winnerName = winner.username
      ? `@${winner.username}`
      : `<a href="tg://user?id=${winner.telegramId}">
          ${winner.name || "Player"}
        </a>`;

    const resultMessage = `
🏆 <b>Result Declared</b>

🎮 Table: #${tableNumber}
👤 Winner: ${winnerName}
💰 Prize: ₹${prize}
`;

    // send to group
    bot.sendMessage(
      foundMatch.chatId || GROUP_ID,
      resultMessage,
      { parse_mode: "HTML" }
    );

    // confirm to admin
    bot.sendMessage(msg.chat.id, "✅ Result sent");

  } catch (err) {
    console.error("RESULT ERROR:", err);
    bot.sendMessage(msg.chat.id, "⚠️ Error declaring result");
  }
});

bot.on("message", async (msg) => {
  try {
    const text = msg.text;
    const userId = msg.from.id;
    const chatId = msg.chat.id;

    if (!text) return;

    if (text.startsWith("/") && 
  !text.match(/^\/(start|play|withdraw|deposit|wallet|result|cancel|approve|approve_withdraw|reject)/)
) {
  return bot.sendMessage(chatId, "❌ Unknown command. Use menu.");
}

    // ================= MENU =================

    if (text === "🎮 Play") {
      userState[userId] = "PLAY";
      return bot.sendMessage(chatId, "🎮 Enter amount to play:");
    }
    if (text === "💳 Deposit") {
  userState[userId] = "DEPOSIT";
  return bot.sendMessage(chatId, "💳 Enter amount to deposit:");
}

    if (text === "💸 Withdraw") {
      userState[userId] = "WITHDRAW";
      return bot.sendMessage(chatId, "💸 Enter amount to withdraw:");
    }

    if (text === "💰 Balance") {
      const user = await User.findOne({ telegramId: userId });
      const balance = user?.balance || 0;

      return bot.sendMessage(chatId, `💰 Balance: ₹${balance}`);
    }

    // ================= AMOUNT INPUT =================

    const amount = parseInt(text);

    if (!amount || amount <= 0) return;

    // 🎮 PLAY FLOW → call your existing /play
    if (userState[userId] === "PLAY") {
      delete userState[userId];

      // simulate /play command
      //return bot.sendMessage(chatId, `/play ${amount}`);
       await handlePlay(userId, chatId, amount, msg);
       sendMainMenu(chatId);
    }
    if (userState[userId] === "DEPOSIT") {
  delete userState[userId];

  await handleDeposit(userId, chatId, amount, msg);
  sendMainMenu(chatId);
}
    // 💸 WITHDRAW FLOW → call your existing /withdraw
    if (userState[userId] === "WITHDRAW") {
      delete userState[userId];

      await handleWithdraw(userId, chatId, amount, msg);
      sendMainMenu(chatId);
    }

  } catch (err) {
    console.error("MENU ERROR:", err);
  }
  
});

