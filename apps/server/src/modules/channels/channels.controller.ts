import type { Response, Request, NextFunction } from "express";
import { ChannelsService } from "./channels.service.js";

const channelsService = new ChannelsService();

export class ChannelsController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const channel = await channelsService.create(req.body, req.userId);
      res.status(201).json(channel);
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const channel = await channelsService.update(
        req.params.id.toString(),
        req.body,
        req.userId,
      );
      res.json(channel);
    } catch (err) {
      next(err);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await channelsService.delete(req.params.id.toString(), req.userId);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const channel = await channelsService.getById(
        req.params.id.toString(),
        req.userId,
      );
      res.json(channel);
    } catch (err) {
      next(err);
    }
  }

  async sendMessage(req: Request, res: Response, next: NextFunction) {
    try {
      const message = await channelsService.sendMessage(
        req.params.id.toString(),
        req.body,
        req.userId,
      );
      res.status(201).json(message);
    } catch (err) {
      next(err);
    }
  }

  async getRules(req: Request, res: Response, next: NextFunction) {
    try {
      const rules = await channelsService.getRules(
        req.params.id.toString(),
        req.userId!,
      );
      res.json(rules);
    } catch (err) {
      next(err);
    }
  }

  async upsertRule(req: Request, res: Response, next: NextFunction) {
    try {
      const rule = await channelsService.upsertRule(
        req.params.id.toString(),
        req.body,
        req.userId!,
      );
      res.json(rule);
    } catch (err) {
      next(err);
    }
  }

  async deleteRule(req: Request, res: Response, next: NextFunction) {
    try {
      await channelsService.deleteRule(
        req.params.id.toString(),
        req.body,
        req.userId!,
      );
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }

  async getMessages(req: Request, res: Response, next: NextFunction) {
    try {
      const limit = req.query.limit
        ? parseInt(req.query.limit.toString())
        : undefined;
      if (limit !== undefined && (isNaN(limit) || limit <= 0)) {
        return res.status(400).json({ error: "Invalid limit parameter" });
      }

      if (parseInt(req.query.limit?.toString() || "0") > 100) {
        return res
          .status(400)
          .json({ error: "Limit cannot be greater than 100" });
      }

      const messages = await channelsService.getMessages(
        req.params.id.toString(),
        req.userId,
        req.query.before?.toString(),
        limit,
        req.query.around?.toString(),
      );
      res.json(messages);
    } catch (err) {
      next(err);
    }
  }

  async updateReadState(req: Request, res: Response, next: NextFunction) {
    try {
      const readState = await channelsService.updateReadState(
        req.params.id.toString(),
        req.body.lastReadMessageId,
        req.userId,
      );
      res.json(readState);
    } catch (err) {
      next(err);
    }
  }

  async reorder(req: Request, res: Response, next: NextFunction) {
    try {
      await channelsService.reorder(
        req.params.serverId.toString(),
        req.body,
        req.userId!,
      );
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }

  async searchMessages(req: Request, res: Response, next: NextFunction) {
    try {
      const query = req.query.q as string;
      const limit = req.query.limit
        ? parseInt(req.query.limit.toString())
        : undefined;
      const messages = await channelsService.searchMessages(
        req.params.id.toString(),
        req.userId,
        query,
        limit,
      );
      res.json(messages);
    } catch (err) {
      next(err);
    }
  }

  async getReadState(req: Request, res: Response, next: NextFunction) {
    try {
      const readState = await channelsService.getReadState(
        req.params.id.toString(),
        req.userId,
      );
      res.json(readState);
    } catch (err) {
      next(err);
    }
  }
}
