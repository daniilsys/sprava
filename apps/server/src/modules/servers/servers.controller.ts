import type { Response, Request, NextFunction } from "express";
import { ServersService } from "./servers.service.js";

const serversService = new ServersService();

export class ServersController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const server = await serversService.create(req.body, req.userId);
      res.status(201).json(server);
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const server = await serversService.update(
        req.params.id.toString(),
        req.body,
        req.userId,
      );
      res.json(server);
    } catch (err) {
      next(err);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await serversService.delete(req.params.id.toString(), req.userId);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const server = await serversService.getById(
        req.params.id.toString(),
        req.userId,
        req.query.includeChannels === "true",
        req.query.includeRoles === "true",
        req.query.includeMembers === "true",
      );
      res.json(server);
    } catch (err) {
      next(err);
    }
  }

  async getMembers(req: Request, res: Response, next: NextFunction) {
    try {
      const { cursor, limit } = req.query as { cursor?: string; limit?: number | undefined };
      const result = await serversService.getMembers(
        req.params.id.toString(),
        req.userId,
        { cursor, limit: limit ?? undefined },
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async getChannels(req: Request, res: Response, next: NextFunction) {
    try {
      const channels = await serversService.getChannels(
        req.params.id.toString(),
        req.userId,
      );
      res.json(channels);
    } catch (err) {
      next(err);
    }
  }

  async joinByInviteCode(req: Request, res: Response, next: NextFunction) {
    try {
      const server = await serversService.joinByInviteCode(
        req.params.code.toString(),
        req.userId,
      );
      res.json(server);
    } catch (err) {
      next(err);
    }
  }

  async leave(req: Request, res: Response, next: NextFunction) {
    try {
      await serversService.leave(req.params.id.toString(), req.userId);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }

  async getBans(req: Request, res: Response, next: NextFunction) {
    try {
      const { cursor, limit } = req.query as { cursor?: string; limit?: number | undefined };
      const result = await serversService.getBans(
        req.params.id.toString(),
        req.userId,
        { cursor, limit: limit ?? undefined },
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async kickMember(req: Request, res: Response, next: NextFunction) {
    try {
      await serversService.kickMember(
        req.params.id.toString(),
        req.params.userId.toString(),
        req.userId!,
      );
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }

  async banMember(req: Request, res: Response, next: NextFunction) {
    try {
      await serversService.banMember(
        req.params.id.toString(),
        req.params.userId.toString(),
        req.userId!,
        req.body.reason,
      );
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }

  async unbanMember(req: Request, res: Response, next: NextFunction) {
    try {
      await serversService.unbanMember(
        req.params.id.toString(),
        req.params.userId.toString(),
        req.userId!,
      );
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }

  async preview(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await serversService.preview(req.params.code as string);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async regenerateInviteCode(req: Request, res: Response, next: NextFunction) {
    try {
      const server = await serversService.regenerateInviteCode(
        req.params.id.toString(),
        req.userId,
      );
      res.json(server);
    } catch (err) {
      next(err);
    }
  }

  async transferOwnership(req: Request, res: Response, next: NextFunction) {
    try {
      await serversService.transferOwnership(
        req.params.id.toString(),
        req.params.userId.toString(),
        req.userId,
      );
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
}
