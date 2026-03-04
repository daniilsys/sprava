import type { Request, Response, NextFunction } from "express";
import { UploadsService } from "./uploads.service.js";

const service = new UploadsService();

export class UploadsController {
  presignAvatar = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await service.presignAvatar(req.body, req.userId!);
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  presignAttachment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await service.presignAttachment(req.body, req.userId!);
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  presignServerIcon = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await service.presignServerIcon(req.body, req.userId!);
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  presignGroupIcon = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await service.presignGroupIcon(req.body, req.userId!);
      res.json(result);
    } catch (err) {
      next(err);
    }
  };
}
