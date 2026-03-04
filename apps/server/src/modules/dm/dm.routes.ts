import { Router } from "express";
import { DmController } from "./dm.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { messagesLimiter } from "../../middlewares/rateLimiter.middleware.js";
import {
  createDmSchema,
  updateDmSchema,
  sendMessageSchema,
  markReadSchema,
} from "./dm.schema.js";

const router = Router();
const controller = new DmController();

router.post("/", authMiddleware, validate(createDmSchema), controller.create);
router.get("/", authMiddleware, controller.getDmConversations);
router.patch(
  "/:id",
  authMiddleware,
  validate(updateDmSchema),
  controller.update,
);
router.delete("/:id/leave", authMiddleware, controller.leaveGroup);
router.post(
  "/:id/participants/:participantId",
  authMiddleware,
  controller.addParticipant,
);
router.delete(
  "/:id/participants/:participantId",
  authMiddleware,
  controller.removeParticipant,
);
router.post(
  "/:id/messages",
  authMiddleware,
  messagesLimiter,
  validate(sendMessageSchema),
  controller.sendMessage,
);
router.get("/:id/messages", authMiddleware, controller.getMessages);

router.get("/:id/read", authMiddleware, controller.getReadState);
router.post(
  "/:id/read",
  authMiddleware,
  validate(markReadSchema),
  controller.updateReadState,
);

export default router;
