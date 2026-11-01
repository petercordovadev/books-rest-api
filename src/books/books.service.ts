import { AppError } from "../lib/AppError.js";
import type { Book, BookInput, BookUpdate } from "./books.schema.js";
import type { BooksStore } from "./books.store.js";

export class BooksService {
  constructor(private readonly store: BooksStore) {}

  list(): Book[] {
    return this.store.list();
  }

  getById(id: number): Book {
    const book = this.store.findById(id);

    if (!book) {
      throw this.notFound(id);
    }

    return book;
  }

  create(input: BookInput): Promise<Book> {
    return this.store.create(input);
  }

  async replace(id: number, input: BookInput): Promise<Book> {
    const book = await this.store.replace(id, input);

    if (!book) {
      throw this.notFound(id);
    }

    return book;
  }

  async update(id: number, input: BookUpdate): Promise<Book> {
    const book = await this.store.update(id, input);

    if (!book) {
      throw this.notFound(id);
    }

    return book;
  }

  async remove(id: number): Promise<void> {
    const book = await this.store.remove(id);

    if (!book) {
      throw this.notFound(id);
    }
  }

  private notFound(id: number): AppError {
    return new AppError(404, "BOOK_NOT_FOUND", `Book with id ${id} was not found`);
  }
}
