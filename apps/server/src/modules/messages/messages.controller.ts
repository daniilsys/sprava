import type { Response, Request, NextFunction } from "express";
import { MessagesService } from "./messages.service.js";

const messagesService = new MessagesService();

export class MessagesController {
  async editMessage(req: Request, res: Response, next: NextFunction) {
    try {
      const { messageId } = req.params;
      const userId = req.userId;
      const updatedMessage = await messagesService.editMessage(
        req.body,
        messageId.toString(),
        userId,
      );
      res.json(updatedMessage);
    } catch (error) {
      next(error);
    }
  }

  async deleteMessage(req: Request, res: Response, next: NextFunction) {
    try {
      const { messageId } = req.params;
      const userId = req.userId;
      await messagesService.deleteMessage(messageId.toString(), userId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  async addReaction(req: Request, res: Response, next: NextFunction) {
    try {
      const { messageId } = req.params;
      const userId = req.userId;
      const { emoji } = req.body;
      await messagesService.addReaction(messageId.toString(), userId, emoji);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  async removeReaction(req: Request, res: Response, next: NextFunction) {
    try {
      const { messageId } = req.params;
      const userId = req.userId;
      const { emoji } = req.body;
      await messagesService.removeReaction(messageId.toString(), userId, emoji);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  replyMessage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await messagesService.replyMessage(
        req.params.messageId as string,
        req.body,
        req.userId!,
      );
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };
}
