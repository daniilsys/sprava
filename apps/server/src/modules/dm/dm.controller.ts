import type { Request, Response, NextFunction } from "express";
import { DmService } from "./dm.service.js";

const dmService = new DmService();

export class DmController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const dm = await dmService.create(req.body, req.userId);
      res.status(201).json(dm);
    } catch (err) {
      next(err);
    }
  }

  async getDmConversations(req: Request, res: Response, next: NextFunction) {
    try {
      const dms = await dmService.getDmConversations(req.userId);
      res.json(dms);
    } catch (err) {
      next(err);
    }
  }

  async sendMessage(req: Request, res: Response, next: NextFunction) {
    try {
      const message = await dmService.sendMessage(
        req.params.id.toString(),
        req.body,
        req.userId,
      );
      res.status(201).json(message);
    } catch (err) {
      next(err);
    }
  }

  async getMessages(req: Request, res: Response, next: NextFunction) {
    try {
      const messages = await dmService.getMessages(
        req.params.id.toString(),
        req.userId,
        req.query.before as string | undefined,
        req.query.limit ? parseInt(req.query.limit as string) : undefined,
      );
      res.json(messages);
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const dm = await dmService.update(
        req.params.id.toString(),
        req.body,
        req.userId,
      );
      res.json(dm);
    } catch (err) {
      next(err);
    }
  }

  async leaveGroup(req: Request, res: Response, next: NextFunction) {
    try {
      await dmService.leaveGroup(req.params.id.toString(), req.userId);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }

  async removeParticipant(req: Request, res: Response, next: NextFunction) {
    try {
      await dmService.removeParticipant(
        req.params.id.toString(),
        req.params.participantId.toString(),
        req.userId,
      );
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }

  async addParticipant(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await dmService.addParticipant(
        req.params.id.toString(),
        req.params.participantId.toString(),
        req.userId,
      );
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  async getReadState(req: Request, res: Response, next: NextFunction) {
    try {
      const readState = await dmService.getReadState(
        req.params.id.toString(),
        req.userId,
      );
      res.json(readState);
    } catch (err) {
      next(err);
    }
  }

  async updateReadState(req: Request, res: Response, next: NextFunction) {
    try {
      const readState = await dmService.read(
        req.userId,
        req.params.id.toString(),
        req.body.lastReadMessageId,
      );
      res.json(readState);
    } catch (err) {
      next(err);
    }
  }
}
