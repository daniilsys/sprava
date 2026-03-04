import { Router } from "express";
import { RolesController } from "./roles.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { createRoleSchema, updateRoleSchema, updatePermissionsSchema } from "./roles.schema.js";

// mergeParams gives access to :serverId from the parent servers router
const router = Router({ mergeParams: true });
const controller = new RolesController();

router.get("/", authMiddleware, controller.list);
router.get("/:memberId", authMiddleware, controller.getMemberRoles);

router.post("/", authMiddleware, validate(createRoleSchema), controller.create);
router.patch(
  "/:roleId",
  authMiddleware,
  validate(updateRoleSchema),
  controller.update,
);
router.delete("/:roleId", authMiddleware, controller.delete);
router.put("/:roleId/permissions", authMiddleware, validate(updatePermissionsSchema), controller.updatePermissions);
router.post(
  "/:roleId/members/:userId",
  authMiddleware,
  controller.assignToMember,
);
router.delete(
  "/:roleId/members/:userId",
  authMiddleware,
  controller.removeFromMember,
);

export default router;
