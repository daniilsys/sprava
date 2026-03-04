import { Router } from "express";
import { UploadsController } from "./uploads.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  avatarPresignSchema,
  attachmentPresignSchema,
  serverIconPresignSchema,
  groupIconPresignSchema,
} from "./uploads.schema.js";
import { uploadLimiter } from "../../middlewares/rateLimiter.middleware.js";

const router = Router();
const controller = new UploadsController();

router.post(
  "/avatar",
  authMiddleware,
  uploadLimiter,
  validate(avatarPresignSchema),
  controller.presignAvatar,
);

router.post(
  "/attachment",
  authMiddleware,
  uploadLimiter,
  validate(attachmentPresignSchema),
  controller.presignAttachment,
);

router.post(
  "/server-icon",
  authMiddleware,
  uploadLimiter,
  validate(serverIconPresignSchema),
  controller.presignServerIcon,
);

router.post(
  "/group-icon",
  authMiddleware,
  uploadLimiter,
  validate(groupIconPresignSchema),
  controller.presignGroupIcon,
);

export default router;
