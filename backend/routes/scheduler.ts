import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import {
  listScheduledPosts,
  createScheduledPost,
  deleteScheduledPost,
  cancelScheduledPost,
  retryScheduledPost,
  getScheduledPostById,
} from "../controllers/schedulerController";

const router = Router();

router.get("/posts", requireAuth, listScheduledPosts);
router.post("/posts", requireAuth, createScheduledPost);
router.delete("/posts/:id", requireAuth, deleteScheduledPost);

router.patch("/posts/:id/cancel", requireAuth, cancelScheduledPost);
router.patch("/posts/:id/retry", requireAuth, retryScheduledPost);
router.get("/posts/:id", requireAuth, getScheduledPostById);

export default router;
