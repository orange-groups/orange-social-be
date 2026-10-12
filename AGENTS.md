# AGENTS.md — NestJS Backend Rules

> **Read before every change.** These rules apply to all AI coding agents and contributors in this NestJS social-network backend.
> Project stack: **NestJS + TypeScript, PostgreSQL + Prisma (if selected), REST + Socket.IO**.
> Frontend: **React + Vite + TypeScript**.

## 0. Non-negotiable agent workflow

1. Read this file, `BACKEND_STRUCTURE.md`, nearby module files, and relevant API contracts **before editing**.
2. Inspect the installed dependencies and `package.json` scripts. Do **not** assume a particular NestJS or Prisma major version, module system, test runner, or ORM integration.
3. Limit changes to the requested feature. Do not rewrite shared infrastructure, alter DB schema, or modify a separate feature without an explicit need.
4. Search for existing DTOs, guards, providers, helpers, events, and reusable abstractions first. Do not introduce duplicates.
5. Follow the **existing** code style and project architecture; if no convention exists, follow this file.
6. Never silently create breaking API changes, migrations, or new dependencies.
7. After changes, run available targeted tests, type/build/lint checks. Report commands executed, failures, untested areas, and files changed. **Never claim tests passed if not run.**
8. Do not commit, push, force-push, delete, or reformat unrelated files unless instructed.

## 1. Architecture and ownership

```text
src/
  main.ts
  app.module.ts
  config/                 # Environment configuration and validation
  common/                 # Reusable cross-cutting concerns ONLY
    decorators/
    dto/
    filters/
    guards/
    interceptors/
    pipes/
    types/
    utils/
  database/               # Database provider / PrismaService
  modules/
    auth/ users/ profile/ feed/ posts/ comments/
    reactions/ friends/ chat/ notifications/ media/
prisma/                    # Prisma schema and migrations IF Prisma is used
```

- **Feature-first**: new business functionality belongs in `src/modules/<feature>/`.
- Standard module files: `<feature>.module.ts`, `<feature>.controller.ts`, `<feature>.service.ts`, `dto/`, optional `repositories/`, `<feature>.gateway.ts` for realtime.
- Do not add an extra service/repository layer without a reason.
- `controller` = transport, validation, input mapping, guards, response status. No direct database queries or complex domain rules.
- `service` = business logic, authorization, transactions, invariants, domain orchestration.
- `repository` = complex, reusable persistence queries when justified; do not expose Prisma-specific types in public HTTP DTOs.
- `gateway` = transport-level Socket.IO authentication, room routing, payload validation, event emission; delegate business logic to services.
- `module` = explicit providers, exports and imports. Export only what consumers require.
- Avoid circular dependencies. Prefer explicit exported services/contracts instead of `forwardRef` unless unavoidable.
- Shared components under `common/` must be generic; never move single-feature logic there preemptively.

## 2. Naming and style

| Item | Convention | Example |
|---|---|---|
| Files/folders | `kebab-case` | `create-post.dto.ts`, `posts/` |
| Classes/types/interfaces | `PascalCase` | `PostsService`, `CreatePostDto` |
| Functions/variables | `camelCase` | `getVisiblePosts`, `authorId` |
| Constants | `UPPER_SNAKE_CASE` when immutable configuration | `MAX_PAGE_SIZE` |
| Boolean | `is/has/can/should` prefixes | `isOwner`, `hasReacted` |
| Controllers | `<feature>.controller.ts` | `posts.controller.ts` |
| Services | `<feature>.service.ts` | `posts.service.ts` |
| DTO | `<action>-<resource>.dto.ts` | `create-comment.dto.ts` |
| Tests | `<file>.spec.ts`, `*.e2e-spec.ts` | `posts.service.spec.ts` |
| REST routes | plural, lowercase, stable | `/posts/:postId/comments` |
| Socket events | `domain:past-tense-or-action` | `message:created`, `chat:send` |

- Use English for code identifiers, commit messages, API identifiers, and comments.
- Keep TypeScript strict. Avoid `any`, `@ts-ignore`, non-null assertions, and unused imports unless justified.
- Prefer `unknown` at untrusted boundaries, then validate and narrow.
- Do not hide errors in empty `catch` blocks or return fake success.
- Prefer named exports for utility modules; follow Nest conventions for decorated classes.
- Keep methods cohesive. Extract functions for distinct responsibilities, not simply to shorten lines.

## 3. Dependency direction and module boundaries

1. Dependencies should flow from transport controllers/gateways to services, then persistence/integrations.
2. A feature requiring another feature must import that feature's exported provider through its Nest module (not directly construct the service).
3. Avoid importing arbitrary internal files from neighboring modules; use a clearly exported contract/provider.
4. Cross-feature event handling should be explicit; never invent event names or change payloads without updating consumers.
5. Do not duplicate ownership: `posts` owns post creation/edit/deletion; `feed` composes timeline queries; `reactions` owns reaction rules; `chat` owns messaging; `notifications` owns notification persistence.

## 4. API contract and DTO rules

- Define and validate **all untrusted inputs** (body, query, params, uploads, Socket.IO payloads).
- Prefer class-based Nest DTOs with `class-validator`/`class-transformer` if that is the established project approach; do not mix validation strategies casually.
- Use global `ValidationPipe` configured with `whitelist: true`, `forbidNonWhitelisted: true`, and `transform: true` where compatible with DTO contracts.
- Do not trust TypeScript types alone for runtime validation.
- Use correct HTTP methods/status codes, consistent version/prefix, and Nest `HttpException` classes.
- Define explicit DTO response shapes; NEVER expose password hashes, refresh token hashes, reset tokens, private emails or internal ORM columns by accident.
- Maintain Swagger/OpenAPI definitions for changed endpoints; coordinate changes with React frontend.
- Pagination parameters MUST be bounded and validated; prefer cursor pagination for feed and high-volume lists, with deterministic ordering and deduplication.
- IDs, timestamps, enum values and nullability must match frontend API contracts. Return UTC ISO 8601 timestamps for JSON.
- Never silently change existing response structure; document breaking changes and migration plans.

## 5. Auth, authorization and security

- Authentication and authorization are **server responsibilities**. The authenticated user identity must come from a verified token/session, NOT from arbitrary request body `userId` or Socket payload `senderId`.
- Require authentication for protected HTTP routes **and** protected Socket connections/events.
- Check permissions on every resource: create/edit/delete, visibility, friendship, message conversation membership, file access and notifications.
- Use password hashing with vetted libraries (Argon2 or bcrypt) and safe verification; never log passwords or tokens.
- Keep signing secrets, database credentials and storage credentials in environment/secret management, never tracked code.
- Apply appropriate CORS origins, Helmet, rate limits, upload size/type limits and abuse safeguards.
- If cookie authentication is used, set appropriate `HttpOnly`, `Secure`, `SameSite` and **CSRF** protections. Configure CORS credentials narrowly.
- Avoid leaking private data or stack traces in production errors. Never log full JWTs, Authorization headers or private message contents.
- Validate and sanitize user-generated rich HTML at rendering/storage boundaries; do not treat Markdown or HTML as safe by default.
- Authorization must be tested for owner / non-owner / unauthenticated cases.

## 6. Database, Prisma, transactions

- Inspect the installed Prisma version before writing client setup/migrations. Recent Prisma versions differ significantly in client generation and driver adapters.
- Do not assume `prisma-client-js` or `prisma-client` generator, ESM/CJS output, or database adapter details without checking repo config.
- Centralize database client lifecycle in a provider/module. Do not instantiate a client per request.
- Put schema changes in `prisma/schema.prisma` and accompanying migrations when using Prisma. Coordinate cross-feature model changes.
- Never rewrite or delete existing migration files to hide conflicts; never perform production `migrate reset` or destructive schema pushes.
- Index frequent queries, friendship pairs, reaction uniqueness, foreign keys, message pagination, and notification unread lookups **based on real query patterns**.
- Enforce critical invariants with database constraints as well as service validation (e.g. single reaction per user/post/type rule, friend-request uniqueness, message idempotency where designed).
- Use database transactions for multi-step writes that must be atomic. Avoid N+1 queries and unbounded result sets.
- Do not fabricate user data, DB records, response objects, or migration outcomes to make tests pass.
- Never execute migrations, seeds or destructive operations against production or unconfirmed remote databases without explicit approval.

## 7. Social-network domain rules

### Posts and feed
- Enforce post visibility (public/friends/private) in **all** read paths, not just the feed UI.
- Only authorized principals may update or delete posts. Exclude blocked/private content from feeds/search.
- Support stable cursor paging; do not fetch the entire feed into memory.

### Comments and reactions
- Verify the parent resource is visible to the acting user before a comment/reaction is created or read.
- Make reaction add/remove operations safe against duplicate or repeated requests; choose semantics and enforce them consistently.
- Keep counts consistent with source rows; document whether counts are persisted or computed.

### Friends
- Prevent self-requests, duplicate/pending requests, blocked-user interactions, and invalid acceptance by third parties.
- Treat friendship state transitions as a validated state machine.

### Chat and notifications
- Only conversation members can access, send to, subscribe to, or mark messages read in that conversation.
- Validate Socket.IO handshake credentials and each privileged event; sanitize room naming, never blindly join arbitrary client-requested rooms.
- Persist important messages before broadcasting; define acknowledgement, retry, deduplication/idempotency and ordering semantics.
- Server defines sender identity and timestamps. Do not accept arbitrary `senderId` or authoritative `createdAt` from clients.
- Notification events should not expose private data to unrelated users; track unread/read state on the server.
- Clean up subscriptions/listeners properly; consider Redis adapter only when horizontally scaling.

### Media
- Validate content type, file signature where appropriate, size, ownership, storage paths and access permissions.
- Avoid storing arbitrary uploaded files inside source directories. Use designated storage and only persist metadata/URLs when appropriate.

## 8. Error handling, performance and observability

- Use consistent validation/error response conventions and codes.
- Catch errors to add meaningful context, handle expected cases or map external errors; otherwise let Nest's exception layer process them.
- Log structured contextual details without personally sensitive content or secrets.
- Set timeouts/retries for external calls; retries must not duplicate side effects.
- Avoid expensive synchronous CPU work in the request path. Consider job workers only if real requirements justify them.
- Use data selection/projection and limits rather than returning every DB field.
- Do not introduce microservices, distributed locks, message brokers, caching, or new infrastructure without a demonstrated need.

## 9. Testing requirements

- Add or update unit tests for non-trivial services: valid path, invalid input, failure path, authorization.
- Write e2e/integration coverage when changing endpoint routing, guards, persistence contracts, or Socket.IO events.
- Mock external integrations in unit tests; do not silently call production services.
- Prefer deterministic tests (no uncontrolled network calls, reliance on timing, live shared DB, or random records).
- Tests must not require real secrets or production credentials.
- Run the scripts available in `package.json`, e.g. `npm run build`, `npm run lint`, `npm test`. Do not assume Jest vs Vitest.

## 10. Git and collaboration

- Use task branches: `feature/posts-create`, `feature/chat-realtime`, `fix/auth-refresh`.
- Use Conventional Commits: `feat(posts): add post creation`, `fix(chat): avoid duplicate messages`.
- Open Pull Requests for changes; include scope, migrations, API/event contract changes, test evidence.
- Treat `src/common/`, `src/database/`, `src/app.module.ts`, `src/main.ts`, Prisma schema and shared auth contracts as **review-required shared files**.
- Avoid unrelated formatting changes, lockfile churn, and mass refactors.

## 11. What an agent must do per task

Before editing:
- Identify owner feature and affected API/Socket contracts.
- Locate existing code/types/tests and check used versions.
- State any assumptions briefly; ask only if blocked by essential missing information.

While editing:
- Make smallest coherent change.
- Keep interfaces/DTOs backwards compatible where possible.
- Add validation, error handling, authorization and tests for new endpoints/events.
- Update documentation when contracts, environment variables or migrations change.

Before finishing:
- Review changed files and unexpected diffs.
- Run relevant tests/build/lint commands if available.
- Report modified files, behavior, any migration/config steps, command results and remaining limitations.
- Never state a module is production-ready just because the Nest CLI generated a skeleton.

## 12. Prohibited shortcuts

**DO NOT:**
- Put DB queries directly into controllers/gateways.
- Trust unvalidated request bodies, params, uploads or socket events.
- Skip authentication or ownership checks "temporarily" in protected features.
- Hardcode secrets, credentials, private signing keys or production URLs.
- Use `any` to silence compiler errors.
- Invent endpoints/events unrelated to the frontend contract.
- Change/overwrite existing DB migrations without explicit coordination.
- Assume scaffolded CRUD endpoints include access control.
- Claim to have run code, migrations or tests that were not actually executed.

**Source of truth priority:** actual repository and accepted contracts > this guide's examples. If they conflict, preserve running code and surface the discrepancy instead of making an unreviewed rewrite.
