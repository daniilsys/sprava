import { Router } from "express";
import { ServersController } from "./servers.controller.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { createServerSchema, updateServerSchema } from "./servers.schema.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { hcaptcha } from "../../middlewares/hcaptcha.middleware.js";
import rolesRouter from "../roles/roles.routes.js";

const router = Router();
const controller = new ServersController();

router.post(
  "/",
  authMiddleware,
  validate(createServerSchema),
  controller.create,
);
router.post("/bans/:id", authMiddleware, controller.banMember);
router.delete("/bans/:id", authMiddleware, controller.unbanMember);

router.patch(
  "/:id/owner",
  hcaptcha,
  authMiddleware,
  controller.transferOwnership,
);

router.get("/:id", authMiddleware, controller.getById);
router.get("/:id/channels", authMiddleware, controller.getChannels);
router.get("/:id/members", authMiddleware, controller.getMembers);
router.get("/:id/bans", authMiddleware, controller.getBans);

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

export default router;
