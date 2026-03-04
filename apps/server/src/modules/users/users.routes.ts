import { Router } from "express";
import { UsersController } from "./users.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { updateAccountSchema, updateProfileSchema } from "./users.schema.js";

const router = Router();
const controller = new UsersController();

// /me routes must be before /:username to avoid "me" being matched as a username
router.get("/me", authMiddleware, controller.getMe);
router.patch("/me", authMiddleware, validate(updateAccountSchema), controller.updateAccount);
router.patch("/me/profile", authMiddleware, validate(updateProfileSchema), controller.updateProfile);

router.get("/search", authMiddleware, controller.search);
router.get("/:username", authMiddleware, controller.getByUsername);

export default router;
