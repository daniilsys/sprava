import { Router } from "express";
import { AuthController } from "./auth.controller.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { registerSchema, loginSchema } from "./auth.schema.js";
import {
  registerLimiter,
  loginLimiter,
  forgotPasswordLimiter,
} from "../../middlewares/rateLimiter.middleware.js";
import { hcaptcha } from "../../middlewares/hcaptcha.middleware.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { changePasswordSchema, changeEmailSchema, forgotPasswordSchema, resetPasswordSchema } from "./auth.schema.js";

const router = Router();
const controller = new AuthController();

router.post(
  "/register",
  hcaptcha,
  registerLimiter,
  validate(registerSchema),
  controller.register,
);
router.post(
  "/login",
  hcaptcha,
  loginLimiter,
  validate(loginSchema),
  controller.login,
);
router.post("/refresh", controller.refresh);
router.post("/logout", controller.logout);

router.get("/verify-email", controller.verifyEmail);
router.post(
  "/resend-verification",
  authMiddleware,
  controller.resendVerification,
);
router.patch(
  "/change-email",
  authMiddleware,
  validate(changeEmailSchema),
  controller.changeEmail,
);
router.patch(
  "/change-password",
  authMiddleware,
  validate(changePasswordSchema),
  controller.changePassword,
);

router.post(
  "/forgot-password",
  forgotPasswordLimiter,
  hcaptcha,
  validate(forgotPasswordSchema),
  controller.forgotPassword,
);
router.post(
  "/reset-password",
  validate(resetPasswordSchema),
  controller.resetPassword,
);

export default router;
