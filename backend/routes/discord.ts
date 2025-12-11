// backend/routes/discord.ts

import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../middleware/requireAuth";

import {
  discordRegisterBot,
  discordListBots,
  discordDeactivateBot,
  discordRefreshBotGuilds,
  discordGetDialogs,
  discordGetHistory,
  discordSendMessage,
  discordSendFile,
  discordEditMessage,
  discordDeleteMessage,
} from "../controllers/discordController";

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

// BOTS MANAGEMENT

// Create bot (add botToken)
router.post("/bots/register", requireAuth, discordRegisterBot);

// List user's bots
router.get("/bots", requireAuth, discordListBots);

// Deactivate bot
router.post("/bots/deactivate", requireAuth, discordDeactivateBot);

// Refresh bot's guilds list
router.post("/bots/refresh-guilds", requireAuth, discordRefreshBotGuilds);

// DIALOGS / HISTORY

// Tree: bot → guilds → channels/threads
router.get("/dialogs", requireAuth, discordGetDialogs);

// Chat history for specific bot
router.get("/history", requireAuth, discordGetHistory);

// MESSAGES

router.post("/sendMessage", requireAuth, discordSendMessage);
router.post("/sendFile", requireAuth, upload.single("file"), discordSendFile);

router.post("/editMessage", requireAuth, discordEditMessage);
router.post("/deleteMessage", requireAuth, discordDeleteMessage);

export default router;
