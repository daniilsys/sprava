import { Router } from "express";
import { ChannelsController } from "./channels.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  createChannelSchema,
  updateChannelSchema,
  sendMessageSchema,
  channelRuleSchema,
  deleteChannelRuleSchema,
  markReadSchema,
} from "./channels.schema.js";
import { messagesLimiter } from "../../middlewares/rateLimiter.middleware.js";

const router = Router();
const channelsController = new ChannelsController();

router.post(
  "/",
  authMiddleware,
  validate(createChannelSchema),
  channelsController.create,
);
router.post(
  "/:id/messages",
  authMiddleware,
  messagesLimiter,
  validate(sendMessageSchema),
  channelsController.sendMessage,
);

router.get("/:id", authMiddleware, channelsController.getById);
router.get("/:id/messages", authMiddleware, channelsController.getMessages);

router.put(
  "/:id",
  authMiddleware,
  validate(updateChannelSchema),
  channelsController.update,
);

router.delete("/:id", authMiddleware, channelsController.delete);

router.get("/:id/rules", authMiddleware, channelsController.getRules);
router.put(
  "/:id/rules",
  authMiddleware,
  validate(channelRuleSchema),
  channelsController.upsertRule,
);
router.delete(
  "/:id/rules",
  authMiddleware,
  validate(deleteChannelRuleSchema),
  channelsController.deleteRule,
);

router.get("/:id/read", authMiddleware, channelsController.getReadState);
router.post(
  "/:id/read",
  authMiddleware,
  validate(markReadSchema),
  channelsController.updateReadState,
);

export default router;
