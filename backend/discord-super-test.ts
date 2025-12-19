// backend/discord-super-test.ts
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

function logHeader(title: string) {
  console.log("\n=======================================");
  console.log(title);
  console.log("=======================================\n");
}

async function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

client.once("ready", async () => {
  logHeader(`Bot logged in as ${client.user?.tag}`);

  const guilds = client.guilds.cache;
  console.log("Guilds:");
  guilds.forEach((g) => console.log(` - ${g.name} (${g.id})`));

  for (const [gid, guild] of guilds) {
    logHeader(`Channels in guild: ${guild.name}`);

    const channels = await guild.channels.fetch();

    channels.forEach((ch) => {
      if (!ch) return;
      const typeName = ChannelType[ch.type] ?? "Unknown";
      console.log(` - [${typeName}] ${ch.name} (${ch.id})`);
    });
  }

  let testChannel: any = null;
  for (const [gid, guild] of guilds) {
    const channels = await guild.channels.fetch();
    testChannel = channels.find((c: any) => c?.type === ChannelType.GuildText);
    if (testChannel) break;
  }

  if (!testChannel) {
    console.log("No text channel found!");
    return;
  }

  console.log(`\nSelected test channel: #${testChannel.name}\n`);

  await testChannel.send("UniMessenger Discord SuperTest: bot active!");

  const file = new AttachmentBuilder(Buffer.from("Hello from file!"), {
    name: "test.txt",
  });
  await testChannel.send({ content: "Test file:", files: [file] });

  const messages: any = await rest.get(
    `${Routes.channelMessages(testChannel.id)}?limit=5`
  );

  console.log("\nLast 5 messages:");
  messages.forEach((m: any) => {
    console.log(` - ${m.author.username}: ${m.content}`);
  });

  console.log("\nSuperTest is now listening for messages...");
});

client.on("messageCreate", async (msg) => {
  const ch = msg.channel;
  const channelName = "name" in ch ? ch.name : "DM";

  console.log(`[${channelName}] ${msg.author.username}: ${msg.content}`);

  if (msg.author.bot) return;

  if (msg.content === "!ping") {
    await msg.reply("Pong!");
  }

  if (msg.content === "!file") {
    const buffer = Buffer.from("This is a test file from the bot.");
    const file = new AttachmentBuilder(buffer, { name: "bot-test.txt" });
    await msg.channel.send({ content: "File attached:", files: [file] });
  }

  if (msg.mentions.has(client.user!)) {
    await msg.reply("Hello! You mentioned me.");
  }

  if (msg.content === "!typing") {
    msg.channel.sendTyping();
    await sleep(1000);
    await msg.reply("Bot showed typing indicator");
  }

  if (msg.content === "!history") {
    const messages: any = await rest.get(
      `${Routes.channelMessages(msg.channel.id)}?limit=3`
    );

    let response = "Last 3 messages:\n";
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
