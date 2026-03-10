import type { Request, Response, NextFunction } from "express";
import { getAuditLog } from "./audit.service.js";

export class AuditController {
  getAuditLog = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { cursor, limit, actionType } = req.query as {
        cursor?: string;
        limit?: number;
        actionType?: string;
      };
      const result = await getAuditLog(
        req.params.serverId.toString(),
        req.userId!,
        { cursor, limit: limit ?? undefined, actionType },
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  };
}
