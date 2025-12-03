// backend/controllers/mediaController.ts
import { sendOk, sendError } from "./telegramController";
import type { Request, Response } from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import { Api } from "telegram";

import telegramClientManager from "../services/telegram/telegramClientManager";
import { prisma } from "../lib/prisma";
import { resolveTelegramPeer } from "../utils/resolveTelegramPeer";
import { logger } from "../utils/logger";
import { log } from "console";

/* ========================================================================
   CONSTANTS & HELPERS (folders)
   ======================================================================== */

const INCOMING_ROOT = path.join(process.cwd(), "stored-media", "telegram");
const OUTGOING_ROOT = path.join(
  process.cwd(),
  "stored-media",
  "telegram-outgoing"
);

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/* ========================================================================
   MULTER (UPLOAD)
   ======================================================================== */

const upload = multer({ storage: multer.memoryStorage() });
/* ========================================================================
   GET INCOMING MEDIA
   GET /media/telegram/:accountId/:fileId
   ======================================================================== */

export async function getTelegramMedia(req: Request, res: Response) {
  try {
    const { accountId, fileId } = req.params;
    const messageId = fileId;
    logger.info("[MEDIA GET] Incoming request", { accountId, messageId });
    if (!accountId || !messageId) {
      return res.status(400).json({ error: "Invalid parameters" });
    }

    const chatDir = path.join(INCOMING_ROOT, accountId);
    ensureDir(chatDir);

    // STEP 1: Try cache
    const cachedPath = findCachedFile(chatDir, messageId);
    if (cachedPath) return streamFile(req, res, cachedPath);
    logger.info("[MEDIA GET] Cache miss, need to download from Telegram");
    // STEP 2: Download via Telegram
    const index = await prisma.telegramMessageIndex.findUnique({
      where: {
        accountId_messageId: { accountId, messageId },
      },
    });

    if (!index) {
      return res.status(404).json({ error: "Media index not found" });
    }

    const peerType =
      index.rawPeerType === "user"
        ? "user"
        : index.rawPeerType === "channel"
        ? "channel"
        : "chat";

    const peerId = index.rawPeerId ?? index.chatId;
    const accessHash = index.rawAccessHash ?? undefined;
    logger.info("[MEDIA GET] Resolved peer info", {
      peerType,
      peerId,
      accessHash,
    });
    if (!peerId) return res.status(500).json({ error: "Missing peerId" });

    let client = telegramClientManager.getClient(accountId);
    if (!client) {
      await telegramClientManager.attachAccount(accountId);
      client = telegramClientManager.getClient(accountId);
      if (!client) return res.status(500).json({ error: "Client unavailable" });
    }

    const peer = resolveTelegramPeer(peerType, peerId, accessHash);
    const msgId = parseInt(messageId, 10);

    const messages = await client.getMessages(peer, { ids: msgId });
    const message = Array.isArray(messages) ? messages[0] : messages;

    logger.info("[MEDIA GET] Retrieved message", { message });

    if (!(message instanceof Api.Message) || !message.media) {
      return res.status(404).json({ error: "Message or media not found" });
    }

    const mime = detectMime(message.media);
    const ext = getExt(mime);
    const finalPath = path.join(
      chatDir,
      ext ? `${messageId}${ext}` : messageId
    );

    const buffer = await client.downloadMedia(message.media);
    if (!buffer) return res.status(404).json({ error: "Download failed" });
    logger.info("[MEDIA GET] Downloaded media, saving to", { finalPath });
    fs.writeFileSync(finalPath, buffer);
    return streamFile(req, res, finalPath);
  } catch (err: any) {
    logger.error("[MEDIA GET ERROR]", err);
    return res.status(500).json({ error: err.message });
  }
}

/* ========================================================================
   STREAMING (supports Range for videos)
   ======================================================================== */

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
    const [startStr, endStr] = range.replace(/bytes=/, "").split("-");
    const start = parseInt(startStr!, 10);
    const end = endStr ? parseInt(endStr, 10) : total - 1;
    const chunkSize = end - start + 1;

    const file = fs.createReadStream(filePath, { start, end });

    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${total}`,
      "Content-Length": chunkSize,
      "Accept-Ranges": "bytes",
      "Content-Type": mime,
    });
    file.pipe(res);
    return;
  }

  res.writeHead(200, {
    "Content-Length": total,
    "Content-Type": mime,
  });
  fs.createReadStream(filePath).pipe(res);
}

/* ========================================================================
   MIME DETECTION HELPERS
   Incoming (Telegram) + Outgoing (Upload)
   ======================================================================== */

function detectUploadExt(mime: string): string {
  if (mime.startsWith("image/jpeg")) return ".jpg";
  if (mime.startsWith("image/png")) return ".png";
  if (mime.startsWith("image/webp")) return ".webp";
  if (mime.startsWith("image/gif")) return ".gif";

  if (mime.startsWith("video/mp4")) return ".mp4";

  if (mime.startsWith("audio/ogg")) return ".ogg";
  if (mime.startsWith("audio/mpeg")) return ".mp3";

  if (mime === "application/pdf") return ".pdf";

  return "";
}
function detectUploadKind(
  mime: string
): "photo" | "video" | "voice" | "gif" | "document" {
  if (!mime) return "document";

  // реальні фото, які Telegram дозволяє шити як photo
  if (mime === "image/jpeg" || mime === "image/jpg" || mime === "image/png") {
    return "photo";
  }

  // gif = animation
  if (mime === "image/gif") return "gif";

  // ВСІ ІНШІ зображення (jfif, webp, bmp, heic...) → документ
  if (mime.startsWith("image/")) return "document";

  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "voice";

  return "document";
}

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

function getExt(mime: string): string {
  if (mime.includes("jpeg")) return ".jpg";
  if (mime.includes("png")) return ".png";
  if (mime.includes("webp")) return ".webp";
  if (mime.includes("gif")) return ".gif";
  if (mime.includes("mp4")) return ".mp4";
  if (mime.includes("pdf")) return ".pdf";
  if (mime.includes("mpeg")) return ".mp3";
  if (mime.includes("ogg")) return ".ogg";
  return "";
}

function guessMime(file: string): string {
  if (file.endsWith(".jpg")) return "image/jpeg";
  if (file.endsWith(".png")) return "image/png";
  if (file.endsWith(".webp")) return "image/webp";
  if (file.endsWith(".gif")) return "image/gif";
  if (file.endsWith(".mp4")) return "video/mp4";
  if (file.endsWith(".mp3")) return "audio/mpeg";
  if (file.endsWith(".ogg")) return "audio/ogg";
  return "application/octet-stream";
}

/* ========================================================================
   UTIL — find cached file
   ======================================================================== */

function findCachedFile(dir: string, id: string): string | null {
  if (!fs.existsSync(dir)) return null;

  const file = fs
    .readdirSync(dir)
    .find((name) => name === id || name.startsWith(`${id}.`));

  return file ? path.join(dir, file) : null;
}
