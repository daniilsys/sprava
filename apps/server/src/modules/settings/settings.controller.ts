import type { Request, Response, NextFunction } from "express";
import { SettingsService } from "./settings.service.js";

const service = new SettingsService();

export class SettingsController {
  getSettings = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const settings = await service.getSettings(req.userId!);
      res.json(settings);
    } catch (err) {
      next(err);
    }
  };

  updateSettings = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const settings = await service.updateSettings(req.userId!, req.body);
      res.json(settings);
    } catch (err) {
      next(err);
    }
  };
}
