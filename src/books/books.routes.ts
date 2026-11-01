import { Router } from "express";
import { validateBody } from "../middleware/validate.js";
import { bookInputSchema, bookUpdateSchema, parseBookId } from "./books.schema.js";
import type { BooksService } from "./books.service.js";

export function createBooksRouter(service: BooksService): Router {
  const router = Router();

  router.get("/", (_req, res) => {
    res.json(service.list());
  });

  router.get("/:id", (req, res) => {
    const id = parseBookId(req.params.id);
    res.json(service.getById(id));
  });

  router.post("/", validateBody(bookInputSchema), async (req, res) => {
    const book = await service.create(req.body);
    res.status(201).location(`/api/v1/books/${book.id}`).json(book);
  });

  router.put("/:id", validateBody(bookInputSchema), async (req, res) => {
    const id = parseBookId(req.params.id);
    const book = await service.replace(id, req.body);
    res.json(book);
  });

  router.patch("/:id", validateBody(bookUpdateSchema), async (req, res) => {
    const id = parseBookId(req.params.id);
    const book = await service.update(id, req.body);
    res.json(book);
  });

  router.delete("/:id", async (req, res) => {
    const id = parseBookId(req.params.id);
    await service.remove(id);
    res.status(204).send();
  });

  return router;
}
