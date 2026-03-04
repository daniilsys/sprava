import { Router } from "express";
import { SettingsController } from "./settings.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { hcaptcha } from "../../middlewares/hcaptcha.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { updateSettingsSchema } from "./settings.schema.js";

const router = Router();
const controller = new SettingsController();

router.get("/", authMiddleware, controller.getSettings);
router.patch("/", authMiddleware, hcaptcha, validate(updateSettingsSchema), controller.updateSettings);

export default router;
