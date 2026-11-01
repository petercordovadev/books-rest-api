# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-10-31

### Added

- Full CRUD API for a book catalog under `/api/v1/books`.
- Runtime validation with Zod and strict schemas that reject unknown fields.
- Centralized JSON error handling with stable error codes.
- OpenAPI 3 specification and interactive Redoc documentation at `/docs`.
- Atomic JSON persistence with a mutation queue and rollback on write failures.
- Seed data separated from runtime data.
- 26 automated tests with Vitest and Supertest, plus coverage thresholds.
- Security middleware: Helmet, global rate limiting and a 10 kB JSON body limit.
- Request logging with Morgan.
- Docker multi-stage image and Compose configuration.
- GitHub Actions CI, CodeQL analysis and Dependabot updates.
- `SECURITY.md` with a private vulnerability reporting policy.

### Changed

- Rewrote the original JavaScript tutorial API in TypeScript with a layered
  routes/service/store architecture.
- Split the Express app factory from the process entry point so the app can be
  tested without binding a port.
- `PUT` now replaces a book, while `PATCH` performs partial updates.
- `DELETE` returns `204 No Content`; `POST` returns `201 Created` with a
  `Location` header.
- Runtime data is stored in `data/db.json` and ignored by git; the committed
  catalog lives in `data/books.seed.json`.

### Security

- Applied rate limiting to every route, including documentation and static
  files.
- Removed client control over book IDs and prevented mass assignment.
- Disabled `X-Powered-By` and added secure HTTP headers.
- Production errors no longer expose stack traces.
- Added `npm audit`, CodeQL and Dependabot to the quality pipeline.

### Fixed

- Missing books now return `404` instead of `200` with an empty body.
- Invalid IDs now return `400` instead of being coerced by `parseInt`.
- Creating a book after a deletion no longer generates duplicate IDs.
- Write failures no longer return a false `201`; the in-memory state is rolled
  back and the error is propagated.
- Malformed JSON, unknown routes and payloads over the limit now return
  consistent JSON errors.

[1.0.0]: https://github.com/petercordovadev/books-rest-api/releases/tag/v1.0.0
