import { copyFile, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { databaseSchema, type Book, type BookInput, type BookUpdate } from "./books.schema.js";

interface BooksStoreOptions {
  dbPath: string;
  seedPath: string;
}

export class BooksStore {
  private books: Book[] = [];
  private readonly dbPath: string;
  private readonly seedPath: string;
  private mutationQueue: Promise<unknown> = Promise.resolve();

  constructor({ dbPath, seedPath }: BooksStoreOptions) {
    this.dbPath = dbPath;
    this.seedPath = seedPath;
  }

  async init(): Promise<void> {
    await mkdir(path.dirname(this.dbPath), { recursive: true });
    await this.ensureDatabaseExists();
    await this.load();
  }

  list(): Book[] {
    return this.books.map((book) => ({ ...book }));
  }

  findById(id: number): Book | undefined {
    const book = this.books.find((item) => item.id === id);
    return book ? { ...book } : undefined;
  }

  create(input: BookInput): Promise<Book> {
    return this.enqueue(async () => {
      const book: Book = { id: this.nextId(), ...input };
      this.books.push(book);

      try {
        await this.persist();
      } catch (error) {
        this.books.pop();
        throw error;
      }

      return { ...book };
    });
  }

  replace(id: number, input: BookInput): Promise<Book | undefined> {
    return this.enqueue(async () => {
      const index = this.books.findIndex((book) => book.id === id);
      const previous = this.books[index];

      if (!previous) {
        return undefined;
      }

      const updated: Book = { id, ...input };
      this.books[index] = updated;

      try {
        await this.persist();
      } catch (error) {
        this.books[index] = previous;
        throw error;
      }

      return { ...updated };
    });
  }

  update(id: number, input: BookUpdate): Promise<Book | undefined> {
    return this.enqueue(async () => {
      const index = this.books.findIndex((book) => book.id === id);
      const current = this.books[index];

      if (!current) {
        return undefined;
      }

      const updated: Book = {
        id: current.id,
        title: input.title ?? current.title,
        author: input.author ?? current.author,
        year: input.year ?? current.year,
      };

      this.books[index] = updated;

      try {
        await this.persist();
      } catch (error) {
        this.books[index] = current;
        throw error;
      }

      return { ...updated };
    });
  }

  remove(id: number): Promise<Book | undefined> {
    return this.enqueue(async () => {
      const index = this.books.findIndex((book) => book.id === id);

      if (index === -1) {
        return undefined;
      }

      const [removed] = this.books.splice(index, 1);

      if (!removed) {
        return undefined;
      }

      try {
        await this.persist();
      } catch (error) {
        this.books.splice(index, 0, removed);
        throw error;
      }

      return { ...removed };
    });
  }

  private async ensureDatabaseExists(): Promise<void> {
    try {
      await readFile(this.dbPath, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }

      await copyFile(this.seedPath, this.dbPath);
    }
  }

  private async load(): Promise<void> {
    const raw = await readFile(this.dbPath, "utf8");
    let parsed: unknown;

    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(`Database file is not valid JSON: ${this.dbPath}`);
    }

    const result = databaseSchema.safeParse(parsed);

    if (!result.success) {
      throw new Error(`Database file has an invalid shape: ${this.dbPath}`);
    }

    this.books = result.data.books;
  }

  private nextId(): number {
    return this.books.reduce((max, book) => Math.max(max, book.id), 0) + 1;
  }

  private async persist(): Promise<void> {
    const temporaryPath = `${this.dbPath}.tmp`;
    const payload = `${JSON.stringify({ books: this.books }, null, 2)}\n`;

    try {
      await writeFile(temporaryPath, payload, "utf8");
      await rename(temporaryPath, this.dbPath);
    } catch (error) {
      await unlink(temporaryPath).catch(() => undefined);
      throw error;
    }
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const run = this.mutationQueue.then(operation, operation);

    this.mutationQueue = run.then(
      () => undefined,
      () => undefined,
    );

    return run;
  }
}
