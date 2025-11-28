// backend/controllers/mediaController.ts

import type { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { Api } from "telegram";
import telegramClientManager from "../services/telegram/telegramClientManager";
import { prisma } from "../lib/prisma";
import { resolveTelegramPeer } from "../utils/resolveTelegramPeer";
import { logger } from "../utils/logger";

/** Cache base folder */
const MEDIA_ROOT = path.join(process.cwd(), "stored-media", "telegram");

function ensureDir(accountId: string) {
  const dir = path.join(MEDIA_ROOT, accountId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * GET /media/telegram/:accountId/:fileId
 *
 * fileId = messageId
 */
export async function getTelegramMedia(req: Request, res: Response) {
  try {
    const { accountId, fileId } = req.params;
    const messageId = fileId;

    const debugFlag = req.query.debug;
    const debug =
      debugFlag === "1" ||
      debugFlag === "true" ||
      debugFlag === "yes" ||
      debugFlag === "debug";

    logger.info("[MEDIA] Incoming GET /media", {
      accountId,
      messageId,
      query: req.query,
    });

    if (!accountId || !messageId) {
      const payload = { error: "Invalid parameters", accountId, messageId };
      if (debug) return res.status(400).json(payload);
      return res.status(400).json({ error: "Invalid parameters" });
    }

    const dir = ensureDir(accountId);

    /** 1) Check cache */
    let cachedPath: string | null = null;
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir);
      const found = files.find(
        (name) => name === messageId || name.startsWith(`${messageId}.`)
      );
      if (found) cachedPath = path.join(dir, found);
    }

    if (cachedPath && fs.existsSync(cachedPath)) {
      logger.info(`[MEDIA] Cache hit → ${cachedPath}`);

      if (debug) {
        return res.json({
          mode: "cache",
          accountId,
          messageId,
          cachedPath,
        });
      }

      return streamFile(req, res, cachedPath);
    }

    logger.info(
      `[MEDIA] Cache miss → downloading messageId=${messageId}, account=${accountId}`
    );

    /** 2) Look up peer info in DB */
    const index = await prisma.telegramMessageIndex.findUnique({
      where: {
        accountId_messageId: { accountId, messageId },
      },
    });

    if (!index) {
      logger.warn("[MEDIA] Media index NOT FOUND", { accountId, messageId });

      const payload = {
        error: "Media index not found",
        accountId,
        messageId,
      };

      return res.status(404).json(debug ? payload : { error: payload.error });
    }

    logger.info("[MEDIA] Index record found", index);

    const rawPeerType = index.rawPeerType as
      | "user"
      | "chat"
      | "channel"
      | "dialog"
      | null;

    let peerType: "user" | "chat" | "channel" = "chat";
    if (rawPeerType === "user") peerType = "user";
    else if (rawPeerType === "channel") peerType = "channel";

    const peerId = index.rawPeerId ?? index.chatId;
    const accessHash = index.rawAccessHash ?? undefined;

    if (!peerId) {
      const payload = {
        error: "Media index missing peerId",
        index,
      };
      return res.status(500).json(debug ? payload : { error: payload.error });
    }

    /** 3) Get Telegram client */
    let client = telegramClientManager.getClient(accountId);
    if (!client) {
      logger.warn("[MEDIA] No active client, attaching...", { accountId });
      await telegramClientManager.attachAccount(accountId);
      client = telegramClientManager.getClient(accountId);
      if (!client) {
        const payload = {
          error: "Telegram client not available",
          accountId,
        };
        return res.status(500).json(debug ? payload : { error: payload.error });
      }
    }

    /** 4) Build input peer */
    const peer = resolveTelegramPeer(peerType, peerId, accessHash);

    const msgIdNum = parseInt(messageId, 10);
    if (Number.isNaN(msgIdNum)) {
      const payload = { error: "Invalid messageId", messageId };
      return res.status(400).json(debug ? payload : { error: payload.error });
    }

    /** 5) Fetch message */
    const messages = await client.getMessages(peer, { ids: msgIdNum });
    const message = Array.isArray(messages) ? messages[0] : messages;

    if (!message || !(message instanceof Api.Message)) {
      const payload = {
        error: "Message not found",
        accountId,
        messageId,
        peerType,
        peerId,
      };
      return res.status(404).json(debug ? payload : { error: payload.error });
    }

    if (!message.media) {
      const payload = {
        error: "Message has no media",
        accountId,
        messageId,
      };
      return res.status(404).json(debug ? payload : { error: payload.error });
    }

    /** 6) Detect MIME */
    const mimeType = detectMime(message.media);
    const ext = getExt(mimeType);

    const filePath = path.join(dir, ext ? `${messageId}${ext}` : messageId);

    /** 7) Download */
    const buffer = await client.downloadMedia(message.media);

    if (!buffer) {
      const payload = { error: "Media download failed" };
      return res.status(404).json(debug ? payload : { error: payload.error });
    }

    fs.writeFileSync(filePath, buffer);
    logger.info(`[MEDIA] Cached → ${filePath}`);

    if (debug) {
      return res.json({
        mode: "downloaded",
        accountId,
        messageId,
        peer: { peerType, peerId, accessHash },
        filePath,
        mimeType,
      });
    }

    return streamFile(
      req,
      res,
      filePath,
      mimeType ?? "application/octet-stream"
    );
  } catch (err: any) {
    logger.error("[MEDIA] ERROR:", err);
    return res.status(500).json({
      error: err.message,
      ...(req.query.debug ? { stack: err.stack } : {}),
    });
  }
}

/** Stream with Range */
function streamFile(
  req: Request,
  res: Response,
  filePath: string,
  forcedMime?: string
) {
  const stat = fs.statSync(filePath);
  const total = stat.size;

  const mime = forcedMime ?? guessMime(filePath);
  const range = req.headers.range;

  if (range) {
    const [startStr = "0", endStr] = range.replace(/bytes=/, "").split("-");
    const start = parseInt(startStr, 10);
    const end = endStr ? parseInt(endStr, 10) : total - 1;

    const chunkSize = end - start + 1;
    const file = fs.createReadStream(filePath, { start, end });

    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${total}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunkSize,
      "Content-Type": mime,
    });

    file.pipe(res);
    return;
  }

  res.writeHead(200, {
    "Content-Length": total,
    "Content-Type": mime,
  });

  return fs.createReadStream(filePath).pipe(res);
}

/** Detect MIME */
function detectMime(media: Api.TypeMessageMedia): string {
  if (media instanceof Api.MessageMediaPhoto) return "image/jpeg";
  if (
    media instanceof Api.MessageMediaDocument &&
    media.document instanceof Api.Document
  ) {
    return media.document.mimeType || "application/octet-stream";
  }
  return "application/octet-stream";
}

/** MIME → EXT */
function getExt(mime: string): string {
  if (mime === "image/jpeg") return ".jpg";
  if (mime === "image/png") return ".png";
  if (mime === "image/webp") return ".webp";
  if (mime === "image/gif") return ".gif";
  if (mime === "video/mp4") return ".mp4";
  if (mime === "application/pdf") return ".pdf";
  if (mime === "audio/mpeg") return ".mp3";
  if (mime === "audio/ogg") return ".ogg";
  return "";
}

/** Fallback MIME detection */
function guessMime(file: string): string {
  if (file.endsWith(".mp4")) return "video/mp4";
  if (file.endsWith(".jpg")) return "image/jpeg";
  if (file.endsWith(".png")) return "image/png";
  if (file.endsWith(".webp")) return "image/webp";
  if (file.endsWith(".gif")) return "image/gif";
  if (file.endsWith(".pdf")) return "application/pdf";
  if (file.endsWith(".mp3")) return "audio/mpeg";
  if (file.endsWith(".ogg")) return "audio/ogg";
  return "application/octet-stream";
}
