import type { RequestHandler } from "express";
import type { ZodType } from "zod";
import { AppError } from "../lib/AppError.js";
import { formatZodIssues } from "../lib/formatZodIssues.js";

export function validateBody<T>(schema: ZodType<T>): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      next(
        new AppError(
          400,
          "VALIDATION_ERROR",
          "Request body is invalid",
          formatZodIssues(result.error),
        ),
      );
      return;
    }

    req.body = result.data;
    next();
  };
}
