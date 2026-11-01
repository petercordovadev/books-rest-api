# Security Policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| 1.x     | Yes       |

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Report vulnerabilities privately through GitHub Security Advisories:

1. Open the repository on GitHub.
2. Go to **Security** → **Advisories** → **Report a vulnerability**.
3. Include a description, reproduction steps and the affected version.

You can expect an initial response within a few days. Once the issue is confirmed, a fix and a
coordinated disclosure will be prepared.

## Scope

This project is a portfolio-grade REST API and is not intended to store sensitive production data.
It intentionally has no authentication layer. Relevant areas for review include:

- Request validation and mass-assignment protection.
- Rate limiting and body-size limits.
- Error handling that avoids leaking stack traces in production.
- Dependency and supply-chain hygiene.
- File persistence and atomic writes.

## Practices used in this repository

- `helmet` security headers and `X-Powered-By` disabled.
- Strict Zod schemas that reject unknown fields.
- Server-generated IDs.
- 10 kB JSON body limit and per-IP rate limiting.
- `.env` and runtime data excluded from version control.
- CI with lint, typecheck, tests, build, `npm audit`, CodeQL and Dependabot.
