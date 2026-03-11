import type { Request, Response, NextFunction } from "express";
import { AuthService } from "./auth.service.js";
import { verifySuccessPage, verifyErrorPage } from "../../config/email.js";

const authService = new AuthService();

export class AuthController {
  register = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await authService.register(req.body);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await authService.login(req.body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  refresh = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { refreshToken } = req.body;
      const result = await authService.refresh(refreshToken);
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { refreshToken } = req.body;
      await authService.logout(refreshToken);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  verifyEmail = async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const { token } = req.query as { token: string };
      await authService.verifyEmail(token);
      res.type("html").send(verifySuccessPage());
    } catch {
      res.type("html").status(400).send(verifyErrorPage(
        "Le lien de v&eacute;rification est invalide ou a expir&eacute;. Veuillez demander un nouveau lien depuis l&rsquo;application."
      ));
    }
  };

  resendVerification = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      await authService.resendVerification(req.userId!);
      res.json({ message: "Verification email sent" });
    } catch (err) {
      next(err);
    }
  };

  changeEmail = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await authService.changeEmail(req.userId!, req.body);
      res.json({ message: "Email changed, verification email sent" });
    } catch (err) {
      next(err);
    }
  };

  changePassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await authService.changePassword(req.userId!, req.body);
      res.json({ message: "Password changed successfully" });
    } catch (err) {
      next(err);
    }
  };

  forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await authService.forgotPassword(req.body);
      // Always return 200 — never reveal whether the email exists
      res.json({ message: "If this email is registered, a reset link has been sent" });
    } catch (err) {
      next(err);
    }
  };

  resetPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await authService.resetPassword(req.body);
      res.json({ message: "Password reset successfully" });
    } catch (err) {
      next(err);
    }
  };
}
