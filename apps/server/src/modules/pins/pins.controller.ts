import type { Request, Response, NextFunction } from "express";
import { PinsService } from "./pins.service.js";

const pinsService = new PinsService();

export class PinsController {
  async pinChannelMessage(req: Request, res: Response, next: NextFunction) {
    try {
      const pin = await pinsService.pinMessage(
        req.params.id.toString(),
        null,
        req.body.messageId,
        req.userId,
      );
      res.status(201).json(pin);
    } catch (err) {
      next(err);
    }
  }

  async unpinChannelMessage(req: Request, res: Response, next: NextFunction) {
    try {
      await pinsService.unpinMessage(
        req.params.id.toString(),
        null,
        req.body.messageId,
        req.userId,
      );
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }

  async getChannelPins(req: Request, res: Response, next: NextFunction) {
    try {
      const pins = await pinsService.getPins(
        req.params.id.toString(),
        null,
        req.userId,
      );
      res.json(pins);
    } catch (err) {
      next(err);
    }
  }

  async pinDmMessage(req: Request, res: Response, next: NextFunction) {
    try {
      const pin = await pinsService.pinMessage(
        null,
        req.params.id.toString(),
        req.body.messageId,
        req.userId,
      );
      res.status(201).json(pin);
    } catch (err) {
      next(err);
    }
  }

  async unpinDmMessage(req: Request, res: Response, next: NextFunction) {
    try {
      await pinsService.unpinMessage(
        null,
        req.params.id.toString(),
        req.body.messageId,
        req.userId,
      );
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }

  async getDmPins(req: Request, res: Response, next: NextFunction) {
    try {
      const pins = await pinsService.getPins(
        null,
        req.params.id.toString(),
        req.userId,
      );
      res.json(pins);
    } catch (err) {
      next(err);
    }
  }
}
