import type { Request, Response, NextFunction } from "express";
import type { z } from "zod";

export const validate =
  (schema: z.ZodType, source: "body" | "query" = "body") =>
  (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success)
      return res.status(400).json({ errors: result.error.flatten() });
    req[source] = result.data;
    next();
  };
