import type { Request, Response, NextFunction } from "express";
import { UsersService } from "./users.service.js";

const usersService = new UsersService();

export class UsersController {
  async getMe(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await usersService.getMe(req.userId);
      res.json(user);
    } catch (err) {
      next(err);
    }
  }

  async updateAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await usersService.updateAccount(req.userId, req.body);
      res.json(user);
    } catch (err) {
      next(err);
    }
  }

  async updateProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const profile = await usersService.updateProfile(req.userId, req.body);
      res.json(profile);
    } catch (err) {
      next(err);
    }
  }

  async getByUsername(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await usersService.getByUsername(
        req.params.username.toString(),
        req.userId,
      );
      res.json(user);
    } catch (err) {
      next(err);
    }
  }

  async search(req: Request, res: Response, next: NextFunction) {
    try {
      const query = req.query.q as string;
      if (!query || query.trim().length < 1)
        return res
          .status(400)
          .json({
            code: "MISSING_QUERY",
            message: "Query parameter 'q' is required",
          });

      const users = await usersService.search(query.trim(), req.userId);
      res.json(users);
    } catch (err) {
      next(err);
    }
  }
}
