import { chmod, cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { databaseSchema } from "../src/books/books.schema.js";
import { BooksService } from "../src/books/books.service.js";
import { BooksStore } from "../src/books/books.store.js";

let temporaryDirectory: string;
let databasePath: string;
let app: ReturnType<typeof createApp>;

beforeEach(async () => {
  temporaryDirectory = await mkdtemp(path.join(tmpdir(), "books-api-"));
  databasePath = path.join(temporaryDirectory, "db.json");

  const seedPath = path.resolve(process.cwd(), "data/books.seed.json");
  await cp(seedPath, databasePath);

  const store = new BooksStore({ dbPath: databasePath, seedPath });
  await store.init();

  app = createApp(new BooksService(store));
});

afterEach(async () => {
  await rm(temporaryDirectory, { recursive: true, force: true });
});

describe("service endpoints", () => {
  it("returns the health status", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: "ok" });
    expect(typeof response.body.uptime).toBe("number");
  });

  it("returns API metadata at the root", async () => {
    const response = await request(app).get("/");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      name: "Books REST API",
      endpoints: { books: "/api/v1/books" },
    });
  });

  it("serves the OpenAPI specification", async () => {
    const response = await request(app).get("/openapi.yaml");

    expect(response.status).toBe(200);
    expect(response.text).toContain("openapi: 3.0.3");
  });

  it("serves the interactive documentation", async () => {
    const response = await request(app).get("/docs");

    expect(response.status).toBe(200);
    expect(response.text).toContain("redoc");
  });
});

describe("GET /api/v1/books", () => {
  it("lists every book", async () => {
    const response = await request(app).get("/api/v1/books");

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(5);
    expect(response.body[0]).toMatchObject({ id: 1, title: "The Great Gatsby" });
  });

  it("returns a single book", async () => {
    const response = await request(app).get("/api/v1/books/1");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: 1,
      title: "The Great Gatsby",
      author: "F. Scott Fitzgerald",
      year: 1925,
    });
  });

  it("returns 404 for a missing book", async () => {
    const response = await request(app).get("/api/v1/books/999");

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("BOOK_NOT_FOUND");
  });

  it("returns 400 for an invalid id", async () => {
    const response = await request(app).get("/api/v1/books/not-a-number");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_BOOK_ID");
  });
});

describe("POST /api/v1/books", () => {
  it("creates a book and returns its location", async () => {
    const response = await request(app).post("/api/v1/books").send({
      title: "The Pragmatic Programmer",
      author: "Andrew Hunt and David Thomas",
      year: 1999,
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      id: 6,
      title: "The Pragmatic Programmer",
      author: "Andrew Hunt and David Thomas",
      year: 1999,
    });
    expect(response.headers.location).toBe("/api/v1/books/6");
  });

  it("rejects a body with an explicit id", async () => {
    const response = await request(app).post("/api/v1/books").send({
      id: 999,
      title: "Invalid",
      author: "Unknown",
      year: 2020,
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects an empty body", async () => {
    const response = await request(app).post("/api/v1/books").send({});

    expect(response.status).toBe(400);
    expect(response.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: "title" })]),
    );
  });

  it("rejects a non-JSON body", async () => {
    const response = await request(app)
      .post("/api/v1/books")
      .set("Content-Type", "text/plain")
      .send("title=Invalid");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("persists the new book to disk", async () => {
    await request(app).post("/api/v1/books").send({
      title: "Persisted",
      author: "Disk",
      year: 2024,
    });

    const database = JSON.parse(await readFile(databasePath, "utf8")) as {
      books: Array<{ id: number; title: string }>;
    };

    expect(database.books).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 6, title: "Persisted" })]),
    );
  });

  it("does not reuse an id after deleting a book", async () => {
    await request(app).delete("/api/v1/books/1").expect(204);
    const response = await request(app).post("/api/v1/books").send({
      title: "No collision",
      author: "Test",
      year: 2024,
    });

    expect(response.status).toBe(201);
    expect(response.body.id).toBe(6);

    const list = await request(app).get("/api/v1/books");
    const ids = list.body.map((book: { id: number }) => book.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("PUT and PATCH /api/v1/books/:id", () => {
  it("replaces a book with PUT", async () => {
    const response = await request(app).put("/api/v1/books/1").send({
      title: "Replaced",
      author: "New Author",
      year: 2020,
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: 1,
      title: "Replaced",
      author: "New Author",
      year: 2020,
    });
  });

  it("rejects a partial body with PUT", async () => {
    const response = await request(app).put("/api/v1/books/1").send({ year: 2020 });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("updates only the provided fields with PATCH", async () => {
    const response = await request(app).patch("/api/v1/books/1").send({ year: 1926 });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: 1,
      title: "The Great Gatsby",
      author: "F. Scott Fitzgerald",
      year: 1926,
    });
  });

  it("rejects an empty PATCH body", async () => {
    const response = await request(app).patch("/api/v1/books/1").send({});

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 when the book does not exist", async () => {
    const response = await request(app).patch("/api/v1/books/999").send({ year: 2020 });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("BOOK_NOT_FOUND");
  });
});

describe("DELETE /api/v1/books/:id", () => {
  it("deletes a book and returns 204", async () => {
    const response = await request(app).delete("/api/v1/books/5");

    expect(response.status).toBe(204);
    expect(response.text).toBe("");

    await request(app).get("/api/v1/books/5").expect(404);
  });

  it("returns 404 when the book does not exist", async () => {
    const response = await request(app).delete("/api/v1/books/999");

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("BOOK_NOT_FOUND");
  });
});

describe("BooksStore", () => {
  it("rejects a database with duplicate ids", () => {
    const result = databaseSchema.safeParse({
      books: [
        { id: 1, title: "First", author: "Author", year: 2000 },
        { id: 1, title: "Second", author: "Author", year: 2001 },
      ],
    });

    expect(result.success).toBe(false);
  });

  it.skipIf(process.platform === "win32" || process.getuid?.() === 0)(
    "rolls back the in-memory state when persistence fails",
    async () => {
      const directory = await mkdtemp(path.join(tmpdir(), "books-store-"));
      const dbPath = path.join(directory, "db.json");
      const seedPath = path.resolve(process.cwd(), "data/books.seed.json");

      await cp(seedPath, dbPath);

      const store = new BooksStore({ dbPath, seedPath });
      await store.init();
      await chmod(directory, 0o555);

      try {
        await expect(
          store.create({ title: "Not persisted", author: "Test", year: 2024 }),
        ).rejects.toThrow();
        expect(store.list()).toHaveLength(5);
      } finally {
        await chmod(directory, 0o755);
        await rm(directory, { recursive: true, force: true });
      }
    },
  );
});

describe("error handling", () => {
  it("returns JSON for malformed JSON bodies", async () => {
    const response = await request(app)
      .post("/api/v1/books")
      .set("Content-Type", "application/json")
      .send("{bad json");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_JSON");
  });

  it("returns JSON for unknown routes", async () => {
    const response = await request(app).get("/api/v1/unknown");

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("ROUTE_NOT_FOUND");
  });

  it("rejects payloads larger than the configured limit", async () => {
    const response = await request(app)
      .post("/api/v1/books")
      .send({
        title: "x".repeat(20_000),
        author: "Large",
        year: 2024,
      });

    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe("PAYLOAD_TOO_LARGE");
  });
});
