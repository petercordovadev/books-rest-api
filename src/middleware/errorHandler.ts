import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { isProduction } from "../config.js";
import { AppError } from "../lib/AppError.js";
import { formatZodIssues } from "../lib/formatZodIssues.js";

interface HttpError {
  status: number;
  message?: string;
  type?: string;
}

function isHttpError(error: unknown): error is HttpError {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof (error as { status?: unknown }).status === "number"
  );
}

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof AppError) {
    res.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details === undefined ? {} : { details: error.details }),
      },
    });
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request is invalid",
        details: formatZodIssues(error),
      },
    });
    return;
  }

  if (isHttpError(error)) {
    const code =
      error.type === "entity.parse.failed"
        ? "INVALID_JSON"
        : error.type === "entity.too.large"
          ? "PAYLOAD_TOO_LARGE"
          : "REQUEST_ERROR";

    const message =
      code === "INVALID_JSON"
        ? "Malformed JSON body"
        : code === "PAYLOAD_TOO_LARGE"
          ? "Request body is too large"
          : isProduction && error.status >= 500
            ? "Internal server error"
            : (error.message ?? "Request could not be processed");

    res.status(error.status).json({
      error: {
        code,
        message,
      },
    });
    return;
  }

  console.error(error);

  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: isProduction ? "Internal server error" : "Unexpected server error",
    },
  });
};
