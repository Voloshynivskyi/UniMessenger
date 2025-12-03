// backend/utils/telegramMedia.ts

import { Api } from "telegram";
import { appendLog } from "./debugLogger";
import type {
  UnifiedTelegramMessageType,
  TelegramMedia,
} from "../types/telegram.types";

/**
 * MAIN MEDIA EXTRACTOR
 */
export function extractMediaFromMessage(msg: Api.Message): {
  type: UnifiedTelegramMessageType;
  media: TelegramMedia | null;
  mediaGroupId: string | null;
} {
  const rawMedia = msg.media;
  const mediaGroupId =
    (msg as any).groupedId != null ? String((msg as any).groupedId) : null;

  appendLog("MEDIA_RAW_INPUT", {
    msgId: msg.id,
    className: rawMedia?.constructor?.name,
    raw: JSON.stringify(rawMedia, null, 2),
  });

  if (!rawMedia) {
    return { type: "text", media: null, mediaGroupId };
  }

  /* ----------------------------------------------------------------------
     PHOTO
     ---------------------------------------------------------------------- */
  if (
    rawMedia instanceof Api.MessageMediaPhoto &&
    rawMedia.photo instanceof Api.Photo
  ) {
    const photo = rawMedia.photo;
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

    if (photo.dcId != null) media.dcId = photo.dcId;
    if (photo.accessHash != null) media.accessHash = String(photo.accessHash);
    if (typeof (photo as any).size === "number")
      media.size = (photo as any).size;

    appendLog("MEDIA_PHOTO_PARSED", media);
    return { type: "photo", media, mediaGroupId };
  }

  /* ----------------------------------------------------------------------
     DOCUMENT (voice, video, audio, gif, sticker, file)
     ---------------------------------------------------------------------- */
  if (
    rawMedia instanceof Api.MessageMediaDocument &&
    rawMedia.document instanceof Api.Document
  ) {
    const doc = rawMedia.document;
    const mimeType = doc.mimeType ?? "application/octet-stream";

    const parsed = parseDocumentAttributes(mimeType, doc.attributes);

    const media: TelegramMedia = {
      id: String(doc.id),
      mimeType,
      groupId: mediaGroupId,
      isSticker: parsed.isSticker,
      isAnimated: parsed.isAnimated,
      isRoundVideo: parsed.isRoundVideo,
      duration: parsed.duration!,
      fileName: parsed.fileName!,
      width: parsed.width!,
      height: parsed.height!,
      waveform: parsed.waveform ?? null,
    };

    if (doc.dcId != null) media.dcId = doc.dcId;
    if (doc.accessHash != null) media.accessHash = String(doc.accessHash);

    if (typeof doc.size === "number") media.size = doc.size;

    appendLog("MEDIA_DOCUMENT_PARSED", media);

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

  /* ----------------------------------------------------------------------
     WEB PAGE → treat as plain text for now
     ---------------------------------------------------------------------- */
  if (
    rawMedia instanceof Api.MessageMediaWebPage &&
    rawMedia.webpage instanceof Api.WebPage
  ) {
    appendLog("MEDIA_WEBPAGE_PARSED", {});
    return { type: "text", media: null, mediaGroupId: null };
  }

  appendLog("MEDIA_UNKNOWN_TYPE", { msgId: msg.id });
  return { type: "unknown", media: null, mediaGroupId };
}

/* ========================================================================
   HELPERS
   ======================================================================== */

function selectBestPhotoSize(sizes: Api.TypePhotoSize[]) {
  if (!sizes?.length) return { w: 0, h: 0 };

  const prog = sizes.find((s) => s instanceof Api.PhotoSizeProgressive);
  if (prog) return { w: prog.w ?? 0, h: prog.h ?? 0 };

  return sizes.reduce(
    (best: any, s: any) => (s.w * s.h > best.w * best.h ? s : best),
    sizes[0]
  );
}

/**
 * Converts Uint8Array waveform → number[]
 */
function convertWaveform(wf: Uint8Array | number[]): number[] {
  if (!wf) return [];
  if (Array.isArray(wf)) return wf;
  return Array.from(wf);
}

/**
 * Parse document attributes
 */
function parseDocumentAttributes(
  mimeType: string,
  attrs: Api.TypeDocumentAttribute[]
) {
  let fileName;
  let width;
  let height;
  let duration;
  let isSticker = false;
  let isAnimated = false;
  let isRoundVideo = false;
  let isVoice = false;
  let waveform: number[] | undefined;

  for (const attr of attrs) {
    if (attr instanceof Api.DocumentAttributeFilename) {
      fileName = attr.fileName;
    } else if (attr instanceof Api.DocumentAttributeVideo) {
      width = attr.w;
      height = attr.h;
      duration = attr.duration;
      isRoundVideo = attr.roundMessage === true;
    } else if (attr instanceof Api.DocumentAttributeAudio) {
      duration = attr.duration ?? duration;
      if (attr.voice) isVoice = true;
      if (attr.waveform) waveform = convertWaveform(attr.waveform);
    } else if (attr instanceof Api.DocumentAttributeSticker) {
      isSticker = true;
    } else if (attr instanceof Api.DocumentAttributeAnimated) {
      isAnimated = true;
    }
  }

  return {
    fileName,
    width,
    height,
    duration,
    isSticker,
    isAnimated,
    isRoundVideo,
    isVoice,
    waveform,
  };
}
