import { z } from "zod";
import { AppError } from "../lib/AppError.js";

const currentYear = new Date().getFullYear();

export const bookSchema = z
  .object({
    id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    title: z.string().trim().min(1, "Title is required").max(200, "Title is too long"),
    author: z.string().trim().min(1, "Author is required").max(120, "Author is too long"),
    year: z
      .number()
      .int("Year must be an integer")
      .min(0, "Year cannot be negative")
      .max(currentYear, `Year cannot be greater than ${currentYear}`),
  })
  .strict();

export const bookInputSchema = bookSchema.omit({ id: true });

export const bookUpdateSchema = bookInputSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, "At least one field must be provided");

const bookIdSchema = z
  .string()
  .regex(/^[1-9]\d*$/, "Book id must be a positive integer")
  .transform((value) => Number(value))
  .pipe(z.number().int().positive().max(Number.MAX_SAFE_INTEGER));

export const databaseSchema = z
  .object({
    books: z.array(bookSchema),
  })
  .strict()
  .refine(
    (database) => new Set(database.books.map((book) => book.id)).size === database.books.length,
    "Book ids must be unique",
  );

export type Book = z.infer<typeof bookSchema>;
export type BookInput = z.infer<typeof bookInputSchema>;
export type BookUpdate = z.infer<typeof bookUpdateSchema>;

export function parseBookId(raw: unknown): number {
  if (typeof raw === "number") {
    if (Number.isSafeInteger(raw) && raw > 0) {
      return raw;
    }

    throw new AppError(400, "INVALID_BOOK_ID", "Book id must be a positive integer");
  }

  const result = bookIdSchema.safeParse(raw);

  if (!result.success) {
    throw new AppError(400, "INVALID_BOOK_ID", "Book id must be a positive integer");
  }

  return result.data;
}
