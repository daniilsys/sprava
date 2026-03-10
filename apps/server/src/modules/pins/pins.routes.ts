import { Router } from "express";
import { PinsController } from "./pins.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { pinMessageSchema, unpinMessageSchema } from "./pins.schema.js";

const router = Router();
const pinsController = new PinsController();

// Channel pins
router.post(
  "/channels/:id/pins",
  authMiddleware,
  validate(pinMessageSchema),
  pinsController.pinChannelMessage,
);
router.delete(
  "/channels/:id/pins",
  authMiddleware,
  validate(unpinMessageSchema),
  pinsController.unpinChannelMessage,
);
router.get(
  "/channels/:id/pins",
  authMiddleware,
  pinsController.getChannelPins,
);

// DM pins
router.post(
  "/dm/:id/pins",
  authMiddleware,
  validate(pinMessageSchema),
  pinsController.pinDmMessage,
);
router.delete(
  "/dm/:id/pins",
  authMiddleware,
  validate(unpinMessageSchema),
  pinsController.unpinDmMessage,
);
router.get(
  "/dm/:id/pins",
  authMiddleware,
  pinsController.getDmPins,
);

export default router;
