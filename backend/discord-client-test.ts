import discordClientManager from "./services/discord/discordClientManager.ts";

import "dotenv/config";

async function main() {
  const TOKEN = process.env.DISCORD_BOT_TOKEN;

  if (!TOKEN) {
    console.error("No DISCORD_BOT_TOKEN in .env");
    process.exit(1);
  }

  console.log("[TEST] Attaching Discord bot...");
  await discordClientManager.attachAccount("test-account-1", TOKEN);

  console.log("[TEST] Bot is running. Press Ctrl+C to exit.");
}

main();
