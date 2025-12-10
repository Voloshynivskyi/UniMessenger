// backend/routes/discord.ts
import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import multer from "multer";

import {
  discordAddAccount,
  discordRemoveAccount,
  discordGetAccounts,
  discordGetDialogs,
  discordGetHistory,
  discordSendMessage,
  discordSendFile,
} from "../controllers/discordController";

const upload = multer({ storage: multer.memoryStorage() });

const router = Router();

/**
 * @route POST /discord/addAccount
 * @desc Attach Discord bot using bot token
 */
router.post("/addAccount", requireAuth, discordAddAccount);

/**
 * @route POST /discord/removeAccount
 * @desc Detach & shutdown Discord bot instance
 */
router.post("/removeAccount", requireAuth, discordRemoveAccount);

/**
 * @route GET /discord/accounts
 * @desc List Discord accounts attached to user
 */
router.get("/accounts", requireAuth, discordGetAccounts);

/**
 * @route GET /discord/dialogs
 * @desc Return guilds, channels & threads tree
 */
router.get("/dialogs", requireAuth, discordGetDialogs);

/**
 * @route GET /discord/history
 * @desc Fetch messages from channel/thread
 */
router.get("/history", requireAuth, discordGetHistory);

/**
 * @route POST /discord/sendMessage
 */
router.post("/sendMessage", requireAuth, discordSendMessage);

/**
 * @route POST /discord/sendFile
 */
router.post("/sendFile", requireAuth, upload.single("file"), discordSendFile);

export default router;
