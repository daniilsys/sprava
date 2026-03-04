import { z } from "zod";

export const registerSchema = z.object({
  username: z.string().min(3).max(16),
  email: z.email(),
  password: z.string().min(8).max(100),
  "h-captcha-response": z.string(),
});

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(100),
  "h-captcha-response": z.string(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(100),
});

export const forgotPasswordSchema = z.object({
  email: z.email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(100),
});

export type ChangePasswordDto = z.infer<typeof changePasswordSchema>;
export type RegisterDto = z.infer<typeof registerSchema>;
export type LoginDto = z.infer<typeof loginSchema>;
export type ForgotPasswordDto = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordDto = z.infer<typeof resetPasswordSchema>;
