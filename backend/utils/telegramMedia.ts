// backend/utils/telegramMedia.ts

import { Api } from "telegram";
import { appendLog } from "./debugLogger";
import type {
  UnifiedTelegramMessageType,
  TelegramMedia,
} from "../types/telegram.types";

/**
 * Main MTProto Api.Message media extractor function (unified).
 */
export function extractMediaFromMessage(msg: Api.Message): {
  type: UnifiedTelegramMessageType;
  media: TelegramMedia | null;
  mediaGroupId: string | null;
} {
  const rawMedia = msg.media;
  const mediaGroupId =
    (msg as any).groupedId != null ? String((msg as any).groupedId) : null;

  // Debug log
  appendLog("MEDIA_RAW_INPUT", {
    msgId: msg.id,
    className: rawMedia?.constructor?.name,
    groupedId: mediaGroupId,
    raw: rawMedia,
  });

  // ───────────────────────────────────────────────
  // NO MEDIA → TEXT
  // ───────────────────────────────────────────────
  if (!rawMedia) {
    appendLog("MEDIA_NONE", { msgId: msg.id });
    return { type: "text", media: null, mediaGroupId };
  }

  // ───────────────────────────────────────────────
  // PHOTO
  // ───────────────────────────────────────────────
  if (
    rawMedia instanceof Api.MessageMediaPhoto &&
    rawMedia.photo instanceof Api.Photo
  ) {
    const photo = rawMedia.photo as Api.Photo;
    const best = selectBestPhotoSize(photo.sizes);

    const media: TelegramMedia = {
      id: String(photo.id),
      mimeType: "image/jpeg",
      width: best.w,
      height: best.h,
      isSticker: false,
      isAnimated: false,
      isRoundVideo: false,
      groupId: mediaGroupId,
    };

    if (photo.dcId != null) {
      media.dcId = photo.dcId;
    }

    if (photo.accessHash != null) {
      media.accessHash = String(photo.accessHash);
    }

    const rawSize = (photo as any).size;
    if (typeof rawSize === "number") {
      media.size = rawSize;
    }

    appendLog("MEDIA_PHOTO_PARSED", {
      msgId: msg.id,
      fileId: media.id,
      width: media.width,
      height: media.height,
      size: media.size,
      groupedId: mediaGroupId,
    });

    return { type: "photo", media, mediaGroupId };
  }

  // ───────────────────────────────────────────────
  // DOCUMENT-BASED (video, audio, voice, sticker, gif, file, etc.)
  // ───────────────────────────────────────────────
  if (
    rawMedia instanceof Api.MessageMediaDocument &&
    rawMedia.document instanceof Api.Document
  ) {
    const doc = rawMedia.document as Api.Document;
    const mimeType = doc.mimeType ?? "application/octet-stream";

    appendLog("MEDIA_DOCUMENT_ATTRIBUTES", {
      msgId: msg.id,
      documentId: doc.id,
      mimeType,
      attributes: doc.attributes,
    });

    const parsed = parseDocumentAttributes(mimeType, doc.attributes || []);

    const media: TelegramMedia = {
      id: String(doc.id),
      mimeType,
      isSticker: parsed.isSticker,
      isAnimated: parsed.isAnimated,
      isRoundVideo: parsed.isRoundVideo,
      groupId: mediaGroupId,
    };

    if (doc.dcId != null) {
      media.dcId = doc.dcId;
    }

    if (doc.accessHash != null) {
      media.accessHash = String(doc.accessHash);
    }

    const size =
      typeof doc.size === "number" ? doc.size : Number(doc.size) || undefined;
    if (typeof size === "number") {
      media.size = size;
    }

    if (parsed.fileName) {
      media.fileName = parsed.fileName;
    }
    if (parsed.width != null) {
      media.width = parsed.width;
    }
    if (parsed.height != null) {
      media.height = parsed.height;
    }
    if (parsed.duration != null) {
      media.duration = parsed.duration;
    }

    appendLog("MEDIA_DOCUMENT_PARSED", {
      msgId: msg.id,
      fileId: media.id,
      mimeType: media.mimeType,
      fileName: media.fileName,
      width: media.width,
      height: media.height,
      duration: media.duration,
      isSticker: media.isSticker,
      isAnimated: media.isAnimated,
      isRoundVideo: media.isRoundVideo,
      groupedId: mediaGroupId,
    });

    // Мапимо на UnifiedTelegramMessageType
    const unifiedType: UnifiedTelegramMessageType = parsed.isSticker
      ? "sticker"
      : parsed.isRoundVideo
      ? "video_note"
      : parsed.isVoice
      ? "voice"
      : mimeType.startsWith("video/")
      ? "video"
      : mimeType.startsWith("audio/")
      ? "audio"
      : mimeType.startsWith("image/")
      ? "photo"
      : parsed.isAnimated || mimeType === "image/gif"
      ? "animation"
      : "file";

    return { type: unifiedType, media, mediaGroupId };
  }

  // ───────────────────────────────────────────────
  // WEB PAGE PREVIEW → тимчасово тип "file"
  // ───────────────────────────────────────────────
  if (
    rawMedia instanceof Api.MessageMediaWebPage &&
    rawMedia.webpage instanceof Api.WebPage
  ) {
    const page = rawMedia.webpage as Api.WebPage;

    const media: TelegramMedia = {
      id: `webpage:${String(page.id)}`,
      mimeType: "text/html",
      groupId: mediaGroupId,
    };

    if (page.siteName) {
      media.fileName = page.siteName;
    }

    appendLog("MEDIA_WEBPAGE_PARSED", {
      msgId: msg.id,
      pageId: page.id,
      siteName: page.siteName,
      groupedId: mediaGroupId,
    });

    // Поки що в UnifiedTelegramMessageType немає "webpage" → мапимо як "file"
    return {
      type: "file",
      media,
      mediaGroupId,
    };
  }

  // ───────────────────────────────────────────────
  // UNKNOWN
  // ───────────────────────────────────────────────
  appendLog("MEDIA_UNKNOWN_TYPE", {
    msgId: msg.id,
    className: rawMedia.constructor?.name,
    raw: rawMedia,
  });

  return { type: "unknown", media: null, mediaGroupId };
}

/* ========================================================================
   HELPERS
   ======================================================================== */

function selectBestPhotoSize(sizes: Api.TypePhotoSize[]) {
  if (!sizes || sizes.length === 0) {
    return { w: 0, h: 0 };
  }

  const progressive = sizes.find(
    (s) => s instanceof Api.PhotoSizeProgressive
  ) as Api.PhotoSizeProgressive | undefined;

  if (progressive) {
    return {
      w: progressive.w ?? 0,
      h: progressive.h ?? 0,
    };
  }

  let best: any = sizes[0];

  for (const s of sizes) {
    if ("w" in s && "h" in s) {
      if ((s.w ?? 0) * (s.h ?? 0) > (best.w ?? 0) * (best.h ?? 0)) {
        best = s;
      }
    }
  }

  return {
    w: best.w ?? 0,
    h: best.h ?? 0,
  };
}

/**
 * Parses Document.attributes to determine the kind of media
 */
function parseDocumentAttributes(
  mimeType: string,
  attrs: Api.TypeDocumentAttribute[]
): {
  fileName?: string;
  width?: number;
  height?: number;
  duration?: number;
  isSticker: boolean;
  isAnimated: boolean;
  isRoundVideo: boolean;
  isVoice: boolean;
} {
  let fileName: string | undefined;
  let width: number | undefined;
  let height: number | undefined;
  let duration: number | undefined;

  let isSticker = false;
  let isAnimated = false;
  let isRoundVideo = false;
  let isVoice = false;

  for (const attr of attrs) {
    if (attr instanceof Api.DocumentAttributeFilename) {
      fileName = attr.fileName;
    } else if (attr instanceof Api.DocumentAttributeVideo) {
      width = attr.w ?? width;
      height = attr.h ?? height;
      duration = attr.duration ?? duration;
      isRoundVideo = attr.roundMessage ?? isRoundVideo;
    } else if (attr instanceof Api.DocumentAttributeAudio) {
      duration = attr.duration ?? duration;
      if (attr.voice) isVoice = true;
    } else if (attr instanceof Api.DocumentAttributeSticker) {
      isSticker = true;
    } else if (attr instanceof Api.DocumentAttributeAnimated) {
      isAnimated = true;
    }
  }

  const result: {
    fileName?: string;
    width?: number;
    height?: number;
    duration?: number;
    isSticker: boolean;
    isAnimated: boolean;
    isRoundVideo: boolean;
    isVoice: boolean;
  } = {
    isSticker,
    isAnimated,
    isRoundVideo,
    isVoice,
  };

  if (fileName !== undefined) result.fileName = fileName;
  if (width !== undefined) result.width = width;
  if (height !== undefined) result.height = height;
  if (duration !== undefined) result.duration = duration;

  return result;
}
