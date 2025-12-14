import type { Request, Response } from "express";
import { schedulerService } from "../services/scheduler/schedulerService";
import { logger } from "../utils/logger";

function ok(res: Response, data: any) {
  return res.status(200).json({ status: "ok", data });
}

function err(res: Response, message: string, code = "ERROR", http = 400) {
  return res.status(http).json({ status: "error", code, message });
}

export async function listScheduledPosts(req: Request, res: Response) {
  try {
    const userId = req.userId!;
    const fromRaw = req.query.from
      ? new Date(String(req.query.from))
      : undefined;
    const toRaw = req.query.to ? new Date(String(req.query.to)) : undefined;

    const args: { userId: string; from?: Date; to?: Date } = { userId };
    if (fromRaw) args.from = fromRaw;
    if (toRaw) args.to = toRaw;

    const posts = await schedulerService.listPosts(args);
    return ok(res, posts);
  } catch (e: any) {
    logger.error("listScheduledPosts failed", { e });
    return err(res, e.message ?? "Failed to list posts");
  }
}

export async function createScheduledPost(req: Request, res: Response) {
  try {
    const userId = req.userId!;
    const { text, scheduledAt, targets } = req.body;

    if (
      !text ||
      !scheduledAt ||
      !Array.isArray(targets) ||
      targets.length === 0
    ) {
      return err(res, "text, scheduledAt and non-empty targets are required");
    }

    const post = await schedulerService.createPost({
      userId,
      text: String(text),
      scheduledAt: new Date(String(scheduledAt)),
      targets,
    });

    return ok(res, post);
  } catch (e: any) {
    logger.error("createScheduledPost failed", { e });
    return err(res, e.message ?? "Failed to create post");
  }
}

export async function deleteScheduledPost(req: Request, res: Response) {
  try {
    const userId = req.userId!;
    const id = req.params.id;
    if (!id) return err(res, "id is required");

    await schedulerService.deletePost(userId, id);
    return ok(res, { success: true });
  } catch (e: any) {
    logger.error("deleteScheduledPost failed", { e });
    return err(res, e.message ?? "Failed to delete post");
  }
}

export async function cancelScheduledPost(req: Request, res: Response) {
  try {
    const userId = req.userId!;
    const id = req.params.id;
    if (!id) return err(res, "id is required");

    const updated = await schedulerService.cancelPost(userId, id);
    return ok(res, updated);
  } catch (e: any) {
    logger.error("cancelScheduledPost failed", { e });
    return err(res, e.message ?? "Failed to cancel post");
  }
}

export async function retryScheduledPost(req: Request, res: Response) {
  try {
    const userId = req.userId!;
    const id = req.params.id;
    if (!id) return err(res, "id is required");

    const updated = await schedulerService.retryPost(userId, id);
    return ok(res, updated);
  } catch (e: any) {
    logger.error("retryScheduledPost failed", { e });
    return err(res, e.message ?? "Failed to retry post");
  }
}

export async function getScheduledPostById(req: Request, res: Response) {
  try {
    const userId = req.userId!;
    const id = req.params.id;
    if (!id) return err(res, "id is required");

    const post = await schedulerService.getPostById(userId, id);
    return ok(res, post);
  } catch (e: any) {
    logger.error("getScheduledPostById failed", { e });
    return err(res, e.message ?? "Failed to load post");
  }
}
