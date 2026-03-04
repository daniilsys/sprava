import type { Response, Request, NextFunction } from "express";
import { FriendshipsService } from "./friendships.service.js";

const friendshipsService = new FriendshipsService();

export class FriendshipsController {
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await friendshipsService.update(req.body, req.userId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async sendRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await friendshipsService.sendRequest(
        req.params.receiverId.toString(),
        req.userId,
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async cancelRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await friendshipsService.cancelRequest(
        req.params.receiverId.toString(),
        req.userId,
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async rejectRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await friendshipsService.rejectRequest(
        req.params.receiverId.toString(),
        req.userId,
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async removeFriend(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await friendshipsService.removeFriend(
        req.params.receiverId.toString(),
        req.userId,
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async unblockUser(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await friendshipsService.unblockUser(
        req.params.receiverId.toString(),
        req.userId,
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async getFriends(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await friendshipsService.getFriends(req.userId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async getBlockedUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await friendshipsService.getBlockedUsers(req.userId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async getFriendRequests(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await friendshipsService.getFriendRequests(req.userId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async getSentRequests(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await friendshipsService.getSentRequests(req.userId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}
