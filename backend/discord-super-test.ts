import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  ChannelType,
  AttachmentBuilder,
} from "discord.js";
import dotenv from "dotenv";
dotenv.config();

const token = process.env.DISCORD_BOT_TOKEN!;
const clientId = process.env.DISCORD_CLIENT_ID!;

const rest = new REST({ version: "10" }).setToken(token);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
});

// ----------------------------------------------
// Helpers
// ----------------------------------------------

function logHeader(title: string) {
  console.log("\n=======================================");
  console.log("🔥 " + title);
  console.log("=======================================\n");
}

async function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

// ----------------------------------------------
// MAIN BOT LOGIC
// ----------------------------------------------

client.once("ready", async () => {
  logHeader(`Bot logged in as ${client.user?.tag}`);

  // 1. Гільдії
  const guilds = client.guilds.cache;
  console.log("📌 Guilds:");
  guilds.forEach((g) => console.log(` - ${g.name} (${g.id})`));

  // 2. Канали для кожної гільдії
  for (const [gid, guild] of guilds) {
    logHeader(`Channels in guild: ${guild.name}`);

    const channels = await guild.channels.fetch();

    channels.forEach((ch) => {
      if (!ch) return;
      const typeName = ChannelType[ch.type] ?? "Unknown";
      console.log(` - [${typeName}] ${ch.name} (${ch.id})`);
    });
  }

  // 3. Вибираємо перший текстовий канал
  let testChannel: any = null;
  for (const [gid, guild] of guilds) {
    const channels = await guild.channels.fetch();
    testChannel = channels.find((c: any) => c?.type === ChannelType.GuildText);
    if (testChannel) break;
  }

  if (!testChannel) {
    console.log("❌ No text channel found!");
    return;
  }

  console.log(`\n🟦 Selected test channel: #${testChannel.name}\n`);

  // 4. Тест: Надсилання повідомлення
  await testChannel.send("🚀 UniMessenger Discord SuperTest: бот активний!");

  // 5. Тест: Надсилання файлу
  const file = new AttachmentBuilder(Buffer.from("Hello from file!"), {
    name: "test.txt",
  });
  await testChannel.send({ content: "📎 Test file:", files: [file] });

  // 6. Тест: Читання історії
  const messages: any = await rest.get(
    `${Routes.channelMessages(testChannel.id)}?limit=5`
  );

  console.log("\n📜 Last 5 messages:");
  messages.forEach((m: any) => {
    console.log(` - ${m.author.username}: ${m.content}`);
  });

  console.log("\n🔥 SuperTest is now listening for messages…");
});

// ----------------------------------------------
// REALTIME EVENTS
// ----------------------------------------------

// 1. Нові повідомлення
client.on("messageCreate", async (msg) => {
  const ch = msg.channel;
  const channelName = "name" in ch ? ch.name : "DM";

  console.log(`💬 [${channelName}] ${msg.author.username}: ${msg.content}`);

  if (msg.author.bot) return;

  // Команда 1: !ping
  if (msg.content === "!ping") {
    await msg.reply("🏓 Pong, Sania!");
  }

  // Команда 2: тест відправки файла
  if (msg.content === "!file") {
    const buffer = Buffer.from("This is a test file from the bot.");
    const file = new AttachmentBuilder(buffer, { name: "bot-test.txt" });
    await msg.channel.send({ content: "📎 File attached:", files: [file] });
  }

  // Команда 3: mentions
  if (msg.mentions.has(client.user!)) {
    await msg.reply("👋 Я тут! Ти мене тегнув.");
  }

  // Команда 4: typing indicator
  if (msg.content === "!typing") {
    msg.channel.sendTyping();
    await sleep(1000);
    await msg.reply("✍️ Бот показав typing");
  }

  // Команда 5: перевірка історії
  if (msg.content === "!history") {
    const messages: any = await rest.get(
      `${Routes.channelMessages(msg.channel.id)}?limit=3`
    );

    let response = "📜 Останні 3 повідомлення:\n";
    for (const m of messages) {
      response += `- ${m.author.username}: ${m.content}\n`;
    }

    await msg.reply(response);
  }
});

// 2. Edited messages
client.on("messageUpdate", (oldMsg, newMsg) => {
  console.log(
    `✏️ Message edited in #${
      "name" in newMsg.channel ? newMsg.channel.name : "DM"
    }`
  );

  console.log(`Before: ${oldMsg.content}`);
  console.log(`After:  ${newMsg.content}`);
});

// 3. Deleted messages
client.on("messageDelete", (msg) => {
  console.log(
    `🗑️ Message deleted in #${"name" in msg.channel ? msg.channel.name : "DM"}`
  );
});

// ----------------------------------------------
// START BOT
// ----------------------------------------------

client.login(token);
