import type { Request, Response, NextFunction } from "express";
import { RolesService } from "./roles.service.js";

const service = new RolesService();

export class RolesController {
  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const roles = await service.list(
        req.params.serverId.toString(),
        req.userId!,
      );
      res.json(roles);
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const role = await service.create(
        req.params.serverId.toString(),
        req.body,
        req.userId!,
      );
      res.status(201).json(role);
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const role = await service.update(
        req.params.serverId.toString(),
        req.params.roleId.toString(),
        req.body,
        req.userId!,
      );
      res.json(role);
    } catch (err) {
      next(err);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await service.delete(
        req.params.serverId.toString(),
        req.params.roleId.toString(),
        req.userId!,
      );
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  assignToMember = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await service.assignToMember(
        req.params.serverId.toString(),
        req.params.roleId.toString(),
        req.params.userId.toString(),
        req.userId!,
      );
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  removeFromMember = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      await service.removeFromMember(
        req.params.serverId.toString(),
        req.params.roleId.toString(),
        req.params.userId.toString(),
        req.userId!,
      );
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  updatePermissions = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const role = await service.updatePermissions(
        req.params.serverId.toString(),
        req.params.roleId.toString(),
        req.body,
        req.userId!,
      );
      res.json(role);
    } catch (err) {
      next(err);
    }
  };

  getMemberRoles = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const roles = await service.getMemberRoles(
        req.params.serverId.toString(),
        req.params.userId.toString(),
        req.userId!,
      );
      res.json(roles);
    } catch (err) {
      next(err);
    }
  };
}
