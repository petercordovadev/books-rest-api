import path from "node:path";
import { fileURLToPath } from "node:url";
import express, { type Express } from "express";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";
import { createBooksRouter } from "./books/books.routes.js";
import type { BooksService } from "./books/books.service.js";
import { config, isTest } from "./config.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFound } from "./middleware/notFound.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const openApiPath = path.resolve(currentDirectory, "../openapi.yaml");

const docsHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Books REST API - Documentation</title>
  </head>
  <body>
    <redoc spec-url="/openapi.yaml"></redoc>
    <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
  </body>
</html>`;

export function createApp(service: BooksService): Express {
  const app = express();

  app.disable("x-powered-by");

  if (config.trustProxy) {
    app.set("trust proxy", 1);
  }

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "https://cdn.redoc.ly"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:"],
          workerSrc: ["'self'", "blob:"],
          upgradeInsecureRequests: null,
        },
      },
    }),
  );

  app.use(express.json({ limit: "10kb", strict: true }));

  if (!isTest) {
    app.use(morgan(config.nodeEnv === "production" ? "combined" : "dev"));
  }

  app.use(
    rateLimit({
      windowMs: config.rateLimitWindowMs,
      limit: config.rateLimitMax,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      skip: () => isTest,
      handler: (_req, res) => {
        res.status(429).json({
          error: {
            code: "RATE_LIMITED",
            message: "Too many requests, please try again later.",
          },
        });
      },
    }),
  );

  app.get("/", (_req, res) => {
    res.json({
      name: "Books REST API",
      version: "1.0.0",
      documentation: "/docs",
      health: "/health",
      endpoints: {
        books: "/api/v1/books",
      },
    });
  });

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/openapi.yaml", (_req, res) => {
    res.sendFile(openApiPath);
  });

  app.get("/docs", (_req, res) => {
    res.type("html").send(docsHtml);
  });

  app.use("/api/v1/books", createBooksRouter(service));

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
