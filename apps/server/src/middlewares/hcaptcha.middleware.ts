import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError.js";

export const hcaptcha = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (process.env.HCAPTCHA_SECRET === "0") return next();

    const token = req.body["h-captcha-response"];

    if (!token) return next(new AppError("hCaptcha token missing", 400, "CAPTCHA_MISSING"));

    const params = new URLSearchParams({
      secret: process.env.HCAPTCHA_SECRET!,
      response: token,
    });

    const response = await fetch("https://api.hcaptcha.com/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const data = await response.json() as { success: boolean };

    if (!data.success) return next(new AppError("hCaptcha verification failed", 400, "CAPTCHA_INVALID"));

    next();
  } catch {
    next(new AppError("hCaptcha verification failed", 500, "CAPTCHA_ERROR"));
  }
};
