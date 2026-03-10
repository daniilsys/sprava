import { Router } from "express";
import { FriendshipsController } from "./friendships.controller.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { updateFriendshipSchema } from "./friendships.schema.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";

const router = Router();
const friendshipsController = new FriendshipsController();

router.post("/:username", authMiddleware, friendshipsController.sendRequest);

router.put(
  "/",
  authMiddleware,
  validate(updateFriendshipSchema),
  friendshipsController.update,
);

router.delete(
  "/:receiverId",
  authMiddleware,
  friendshipsController.cancelRequest,
);
router.delete(
  "/:receiverId/reject",
  authMiddleware,
  friendshipsController.rejectRequest,
);
router.delete(
  "/:receiverId/remove",
  authMiddleware,
  friendshipsController.removeFriend,
);
router.delete(
  "/:receiverId/unblock",
  authMiddleware,
  friendshipsController.unblockUser,
);

router.get("/friends", authMiddleware, friendshipsController.getFriends);
router.get("/blocked", authMiddleware, friendshipsController.getBlockedUsers);
router.get(
  "/requests",
  authMiddleware,
  friendshipsController.getFriendRequests,
);
router.get(
  "/requests/sent",
  authMiddleware,
  friendshipsController.getSentRequests,
);

export default router;
