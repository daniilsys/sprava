import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError";
import { ZodError, z } from "zod";
import { Prisma } from "@sprava/db";
import { logger } from "../config/logger.js";

export const errorMiddleware = (
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // Application known errors
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      code: err.code,
      message: err.message,
    });
  }

  // Zod validation errors
  if (err instanceof ZodError) {
    return res.status(400).json({
      code: "VALIDATION_ERROR",
      errors: z.treeifyError(err).errors,
    });
  }

  // Prisma errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return res.status(400).json({
        code: "ALREADY_EXISTS",
        message: "This record already exists",
        meta: err.meta,
      });
    }
  }

  // Unknown errors
  logger.error({ err }, "Unexpected error");
  return res.status(500).json({
    code: "INTERNAL_ERROR",
    message: "Internal server error",
  });
};
