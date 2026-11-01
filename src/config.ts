import "dotenv/config";
import path from "node:path";

function readPositiveNumber(name: string, fallback: number): number {
  const raw = process.env[name];

  if (raw === undefined || raw === "") {
    return fallback;
  }

  const value = Number(raw);

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid ${name}: expected a positive number, received "${raw}"`);
  }

  return value;
}

const projectRoot = process.cwd();

export const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: readPositiveNumber("PORT", 3000),
  dbPath: path.resolve(projectRoot, process.env.DB_PATH ?? "data/db.json"),
  seedPath: path.resolve(projectRoot, process.env.SEED_PATH ?? "data/books.seed.json"),
  rateLimitWindowMs: readPositiveNumber("RATE_LIMIT_WINDOW_MS", 15 * 60 * 1000),
  rateLimitMax: readPositiveNumber("RATE_LIMIT_MAX", 100),
  trustProxy: process.env.TRUST_PROXY === "true",
} as const;

export const isProduction = config.nodeEnv === "production";
export const isTest = config.nodeEnv === "test";
