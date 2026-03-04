import { Router } from "express";
import { MessagesController } from "./messages.controller.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { editMessageSchema, replyMessageSchema } from "./messages.schema.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { messagesLimiter } from "../../middlewares/rateLimiter.middleware.js";

const router = Router();
const messagesController = new MessagesController();

router.put(
  "/:messageId",
  authMiddleware,
  validate(editMessageSchema),
  messagesController.editMessage,
);

router.delete("/:messageId", authMiddleware, messagesController.deleteMessage);
router.delete(
  "/:messageId/reactions",
  authMiddleware,
  messagesController.removeReaction,
);

router.post(
  "/:messageId/reactions",
  authMiddleware,
  messagesController.addReaction,
);

router.post(
  "/:messageId/reply",
  authMiddleware,
  messagesLimiter,
  validate(replyMessageSchema),
  messagesController.replyMessage,
);

export default router;
