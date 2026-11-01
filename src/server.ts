import { createApp } from "./app.js";
import { BooksService } from "./books/books.service.js";
import { BooksStore } from "./books/books.store.js";
import { config } from "./config.js";

async function main(): Promise<void> {
  const store = new BooksStore({
    dbPath: config.dbPath,
    seedPath: config.seedPath,
  });

  await store.init();

  const app = createApp(new BooksService(store));
  const server = app.listen(config.port, () => {
    console.log(`Books REST API listening on http://localhost:${config.port} (${config.nodeEnv})`);
  });

  let shuttingDown = false;

  const shutdown = (signal: string): void => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    console.log(`Received ${signal}. Shutting down gracefully...`);

    server.close((error) => {
      if (error) {
        console.error("Error while closing the server:", error);
        process.exit(1);
      }

      process.exit(0);
    });

    setTimeout(() => {
      console.error("Forcing shutdown after timeout.");
      process.exit(1);
    }, 10_000).unref();
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((error: unknown) => {
  console.error("Failed to start the server:", error);
  process.exit(1);
});
