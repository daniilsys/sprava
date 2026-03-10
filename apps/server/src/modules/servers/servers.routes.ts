import { Router } from "express";
import { ServersController } from "./servers.controller.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  createServerSchema,
  updateServerSchema,
  paginationQuery,
} from "./servers.schema.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { hcaptcha } from "../../middlewares/hcaptcha.middleware.js";
import rolesRouter from "../roles/roles.routes.js";
import auditRouter from "../audit/audit.routes.js";

const router = Router();
const controller = new ServersController();

router.post(
  "/",
  authMiddleware,
  validate(createServerSchema),
  controller.create,
);
router.get("/preview/:code", controller.preview);
router.delete("/:id/members/:userId", authMiddleware, controller.kickMember);
router.post("/:id/bans/:userId", authMiddleware, controller.banMember);
router.delete("/:id/bans/:userId", authMiddleware, controller.unbanMember);

router.patch(
  "/:id/owner",
  hcaptcha,
  authMiddleware,
  controller.transferOwnership,
);

router.post("/:id/regenerate-invite", authMiddleware, controller.regenerateInviteCode);
router.get("/:id", authMiddleware, controller.getById);
router.get("/:id/channels", authMiddleware, controller.getChannels);
router.get(
  "/:id/members",
  authMiddleware,
  validate(paginationQuery, "query"),
  controller.getMembers,
);
router.get(
  "/:id/bans",
  authMiddleware,
  validate(paginationQuery, "query"),
  controller.getBans,
);

router.put(
  "/:id",
  authMiddleware,
  validate(updateServerSchema),
  controller.update,
);

router.delete("/:id", authMiddleware, controller.delete);
router.post(
  "/join/:code",
  authMiddleware,
  hcaptcha,
  controller.joinByInviteCode,
);
router.delete("/leave/:id", authMiddleware, controller.leave);

router.use("/:serverId/roles", rolesRouter);
router.use("/:serverId/audit-log", auditRouter);

export default router;
