// const TelegramBot = require("node-telegram-bot-api");

// const TOKEN = "8428988318:AAFGwEXVUhjyWfvLH6ck5tBA7KH3Q8VFado";
// const GROUP_ID = -1003867198148; // your group id


// const bot = new TelegramBot(TOKEN, { polling: true });

// bot.onText(/\/start/, (msg) => {
//   if (msg.chat.type !== "private") {
//     return;
//   }

//   bot.sendMessage(msg.chat.id, "Click below:", {
//     reply_markup: {
//       keyboard: [[
//         {
//           text: "🎲 Place New Table",
//           web_app: { url: "https://ludo-webapp2.vercel.app" }
//         }
//       ]],
//       resize_keyboard: true
//     }
//   });
// });

// bot.on("web_app_data", (msg) => {
//   const data = JSON.parse(msg.web_app_data.data);

//   const tableId = "T" + Math.floor(1000 + Math.random() * 9000);

//   const text = `🎲 Table #${tableId} by ${msg.from.first_name}
// ${data.amount} | ${data.type} | ${data.game}+ game`;

//   bot.sendMessage(GROUP_ID, text);
// });

// console.log("Bot running...");



const TelegramBot = require("node-telegram-bot-api");

const TOKEN = "8428988318:AAFGwEXVUhjyWfvLH6ck5tBA7KH3Q8VFado";
const GROUP_ID = -1003867198148;
const bot = new TelegramBot(TOKEN, { polling: true });

let queues = {}; // store players by amount
let tableNumber = 300;

// ⏳ Remove player after 5 minutes
const WAIT_TIME = 5 * 60 * 1000;

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "🎲 Click below to create table:", {
    reply_markup: {
      keyboard: [[
        {
          text: "🎲 Place New Table",
          web_app: { url: "https://ludo-webapp2.vercel.app" }
        }
      ]],
      resize_keyboard: true
    }
  });
});

bot.on("web_app_data", (msg) => {
  const data = JSON.parse(msg.web_app_data.data);
  const amount = data.amount;

  if (!queues[amount]) {
    queues[amount] = [];
  }

  // Prevent duplicate join
  if (queues[amount].find(p => p.id === msg.from.id)) {
    return bot.sendMessage(msg.chat.id, "⚠️ You are already waiting for this amount.");
  }

  // Add player
  queues[amount].push({
    id: msg.from.id,
    name: msg.from.first_name,
    username: msg.from.username,
    joinedAt: Date.now()
  });

  bot.sendMessage(msg.chat.id, "⏳ Waiting for other players...");

  // Remove player after WAIT_TIME
  setTimeout(() => {
    queues[amount] = queues[amount].filter(p => p.id !== msg.from.id);
  }, WAIT_TIME);

  // If 4 players ready
  if (queues[amount].length >= 4) {

    // Shuffle players randomly
    const players = queues[amount].sort(() => 0.5 - Math.random()).slice(0,4);

    const p1 = `[${players[0].name}](tg://user?id=${players[0].id})`;
    const p2 = `[${players[1].name}](tg://user?id=${players[1].id})`;
    const p3 = `[${players[2].name}](tg://user?id=${players[2].id})`;
    const p4 = `[${players[3].name}](tg://user?id=${players[3].id})`;

    const message = `
🏆 *MATCH FOUND!*

${p1} 🤝 ${p2}
VS
${p3} 🤝 ${p4}

💰 Rs ${amount} | ${data.type} | ${data.game}+ game
--------------------------------
🎲 Table #${tableNumber}
`;

    bot.sendMessage(GROUP_ID, message, {
      parse_mode: "Markdown"
    });

    tableNumber++;

    // Remove matched players
    queues[amount] = queues[amount].slice(4);
  }
});

console.log("🚀 Bot running...");