// backend/utils/mediaConverter.ts

import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import { join } from "path";
import { spawn } from "child_process";

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", ["-y", ...args]);

    let stderr = "";
    proc.stderr.on("data", (data) => {
      const text = data.toString();
      stderr += text;
      console.error("[ffmpeg]", text);
    });

    proc.on("error", (err) => reject(err));

    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}\n${stderr}`));
    });
  });
}

export async function convertWebmVoiceToOgg(inputBuf: Buffer) {
  const id = randomUUID();
  const tmp = "/tmp";
  const inPath = join(tmp, `voice-${id}.webm`);
  const outPath = join(tmp, `voice-${id}.ogg`);

  await fs.writeFile(inPath, inputBuf);

  await runFfmpeg([
    "-i",
    inPath,
    "-ac",
    "1",
    "-c:a",
    "libopus",
    "-b:a",
    "48k",
    outPath,
  ]);

  const buffer = await fs.readFile(outPath);
  fs.unlink(inPath).catch(() => {});
  fs.unlink(outPath).catch(() => {});

  return { buffer, fileName: "voice-message.ogg" };
}

export async function convertWebmVideoToMp4Note(inputBuf: Buffer) {
  const id = randomUUID();
  const tmp = "/tmp";
  const inPath = join(tmp, `video-${id}.webm`);
  const outPath = join(tmp, `video-${id}.mp4`);

  await fs.writeFile(inPath, inputBuf);

  await runFfmpeg([
    "-i",
    inPath,
    "-vf",
    "scale=480:-1, crop=480:480",

    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "23",
    "-c:a",
    "aac",
    "-b:a",
    "64k",
    "-movflags",
    "+faststart",
    outPath,
  ]);

  const buffer = await fs.readFile(outPath);
  fs.unlink(inPath).catch(() => {});
  fs.unlink(outPath).catch(() => {});

  return { buffer, fileName: "video-note.mp4" };
}
