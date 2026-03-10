import { Router } from "express";
import { AuditController } from "./audit.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { auditLogQuery } from "./audit.schema.js";

const router = Router({ mergeParams: true });
const controller = new AuditController();

router.get(
  "/",
  authMiddleware,
  validate(auditLogQuery, "query"),
  controller.getAuditLog,
);

export default router;
