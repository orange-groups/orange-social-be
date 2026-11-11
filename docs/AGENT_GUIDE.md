# Agent guide — Orange Social backend handoff

## 1. Read first

This backend is a coursework social-network project. Prefer small, complete feature flows over production-scale infrastructure.

Read in order:

1. Root `AGENTS.md` for mandatory contribution rules.
2. This guide for current project decisions and scope.
3. `docs/API_SKELETON.md` for the API inventory and placeholder behavior.
4. Relevant module files, `src/database/schema.ts`, existing tests and auth contracts.

The workspace may also contain `PLAN.md` and `IMPLEMENTATION_PLAN.md` one directory above this repository. They describe the broader proposal but are not guaranteed to exist in a standalone clone. This guide and the checked-in skeleton contain the essential handoff; do not depend on files outside the repository to build or test.

**Do not implement every TODO automatically.** The approved work so far is the backend skeleton only. Wait for the user to name the next feature/module and confirm its boundaries. Never treat this guide as approval for new dependencies, DB migrations, infrastructure, commits or pushes.

## 2. Actual stack and existing behavior

- NestJS 11, TypeScript, REST and existing Socket.IO scaffolds.
- PostgreSQL with **Drizzle**, using `DrizzleService`; `PrismaService` is an old placeholder, not the persistence implementation.
- Existing auth supports registration, login, refresh, logout, current user and password recovery.
- Access tokens are Bearer JWTs. Refresh tokens use an HttpOnly cookie; preserve current cookie, rotation and tokenVersion behavior.
- Password recovery still sends SMTP email using Nodemailer inside `src/modules/auth/password-recovery.service.ts`.
- The new `MailService` is **not connected to auth**. Do not switch auth to its placeholder: that would break recovery.
- No Cloudinary/Resend SDK was installed for the skeleton. No new business schema or migration was created.
- The new `database/types/transaction.ts` is only an internal type alias, not database functionality.

Inspect `package.json` and installed versions again before each task; do not assume this snapshot remains current.

## 3. What the skeleton does and does not do

There are 23 protected routes across media/profile/friends/users/posts/feed/notifications plus a mail module with no public endpoint.

- Controllers bind routes, validate basic DTO/path/query shapes, read authenticated identity and delegate to a typed service.
- Service/repository/adapter/helper methods intentionally throw `NotImplementedException`.
- A valid authenticated request reaches HTTP 501, not fake success.
- Existing exception formatting wraps errors and masks 5xx details; 501 currently uses `HTTP_ERROR`, not a dedicated error code.
- Response interfaces describe future successful outputs; they do not mean successful behavior exists yet.
- No new queries, ownership checks, transactions, upload signing, quota enforcement, cleanup execution, recommendation algorithm or email sending has been implemented.
- DTO validation is basic: whitespace normalization, future-date checks, empty PATCH rejection and resource-level authorization remain implementation tasks.
- The existing notification/chat gateways are legacy scaffolds, not evidence of secure realtime features.

Do not remove a 501 by returning empty objects, fabricated records or unconditional true. Replace a placeholder only when its actual responsibility is implemented and tested.

## 4. Ownership and directory conventions

| Location | Responsibility |
| --- | --- |
| `src/common/guards/jwt-auth.guard.ts` | Bearer authentication; consumers import AuthModule |
| `src/common/guards/trusted-origin.guard.ts` | Trusted origin checks for relevant auth requests |
| `src/common/decorators/current-user.decorator.ts` | Reads request.user; does not authorize anything by itself |
| `src/modules/<feature>/dto/` | Input validation and public response contracts |
| `src/modules/<feature>/types/` | Feature-internal and inter-service types |
| `src/modules/<feature>/repositories/` | Persistence queries, never DTOs |
| `src/database/` | Shared database connection and internal transaction type |

- Keep guards shared as above. Do not recreate auth/guards or unused strategies directories.
- The user explicitly removed roles: do not reintroduce RolesGuard, admin/user claims or permissions infrastructure without a new request.
- Authorization is still required in services: author-only post changes, recipient-only request acceptance/notification reads, viewer-specific post visibility.
- Do not use request body userId/authorId/actorId as the authenticated actor.
- Do not add repositories solely to wrap trivial queries; use existing ones where shared SQL/transactions justify them.
- Do not pre-inject unused dependencies into placeholder services. Wire real dependencies when implementing the feature.
- Skeleton files locally allow unused `_parameter` names for typed signatures. Remove or narrow those file-level ESLint allowances when implementation uses the parameters; do not disable lint globally.

## 5. Contract decisions to preserve

### HTTP and data

- No new global API prefix. Preserve existing routes including `/auth/regis`.
- Keep the current success envelope `{ success: true, data }` and failure envelope `{ success: false, error: { code, message, details } }`.
- Controllers must not wrap responses again; the interceptor already does it.
- IDs are UUID strings; JSON timestamps use UTC ISO 8601.
- Pagination uses `items`, `nextCursor`, `hasMore`; default limit 10, maximum 50.
- Cursor helpers are still placeholders. Implement version/kind/filter validation and deterministic keyset order; no fetching entire tables into memory.
- `fullName`, not displayName, is the existing user field (maximum 150).
- Friends use `receiverId`; notifications use `recipientId`.
- Post privacy is `public | friends | only_me`, not private.
- Notifications keep `content` and `isRead`, not the earlier draft's message/readAt.
- No public endpoint for arbitrary email sending or notification creation.

### Profile

- Profile means the full editable profile, not only bio.
- PATCH allows fullName, bio and dateOfBirth. Missing means unchanged; null clears nullable fields. Reject null fullName.
- Date of birth is private in the proposal: return it only in the owner's profile, formatted YYYY-MM-DD; handle the current timestamp column consistently.
- Do not allow email, username, password, avatarUrl or coverUrl changes through generic profile PATCH.
- Avatar completion takes an uploadId, not an arbitrary URL from the client.
- Cover images and post editing are optional and not scaffolded as HTTP APIs in this iteration.

### Friends and notifications

- Prevent self-requests, duplicate requests in either direction, invalid actors and invalid state transitions.
- Proposed friendship representation is two symmetric rows in one transaction; verify the real DB/data before adopting it.
- Current pending-request uniqueness only covers one direction. An unordered-pair unique index and conflict audit require a reviewed migration.
- Proposed writes lock the same pair of users in a consistent order; service-level SELECT-before-INSERT alone does not prevent races.
- Friends call NotificationsService through its module export; do not write notification tables from another module.
- Persist notifications in the same DB transaction as the relevant friend action when that feature is implemented. No provider/network calls inside the transaction.
- No self-notifications; idempotent retries must not create duplicates. New legitimate actions need distinct deduplication keys.
- Target/deduplication fields are only proposed types: their database columns do not exist in the current schema.
- Polling is the MVP approach. Do not implement new realtime/broker infrastructure automatically.

### Posts and feed

- Only create personal text posts in this scope. Exclude group posts from new read paths until membership authorization is implemented.
- Enforce public/friends/only_me and soft-delete predicates consistently in detail, author lists and feed.
- Author lists belong to Posts (`GET /posts?authorId=...`), not ProfileController.
- Share the SQL visibility predicate inside PostsRepository and expose batch read methods via PostsService; avoid N+1 queries and cross-module repository access.
- RecommendationProvider is only an interface. There is no bound fake provider or known external endpoint to call.
- Confirm the recommendation module's actual contract with its owner before writing an adapter.
- Feed ranking needs stable session/cursor ordering. Recheck visibility after retrieving candidates.
- Proposed fallback: recommendation failure on the first page can start a latest-post session; failure mid-ranked-session should allow retry rather than silently change order.
- A latest-only feed is an interim implementation, not completion of the requirement to consume recommendations.

## 6. Cloudinary implementation constraints

Target flow: FE requests a signed upload → FE uploads directly to Cloudinary → FE asks profile to attach the uploadId → BE verifies and persists the association.

- Only BE holds API secret. Public API key/cloud name may appear in upload responses.
- BE chooses publicId, purpose, preset, timestamp and overwrite behavior; never sign arbitrary client-supplied parameters.
- Proposed avatar limits: JPEG/PNG/WebP, 2 MB; signed-only preset; overwrite false; 5 signature requests/minute and 30/day/user. These are proposal defaults, not enforced today.
- Configure and test storage-side restrictions; FE checks and signatures alone do not validate file bytes or guarantee all limits.
- A Cloudinary signature is not a one-time ticket. Application completeBefore does not revoke a signature at Cloudinary.
- Verify expected publicId/owner/purpose plus metadata fetched server-side; reject arbitrary URLs, other users' assets and expired or mismatched sessions.
- Media upload sessions, asset references, quotas and cleanup status need approved schema changes before production implementation.
- Handle replay, repeated completion and concurrent avatar replacement atomically. Lock/recheck session state when attaching.
- Delete old assets only after the new profile reference commits. Never delete unknown legacy resources or images still referenced by a profile.
- Cleanup must coordinate with attachment and account for Cloudinary's actual signature-validity window. The plan's tentative two-hour delay must be checked against provider behavior, not blindly hardcoded.
- No reliable cleanup via setInterval on Vercel. Design a bounded internal command/scheduler only when requested; no unauthenticated cleanup route.
- External calls need timeouts; DB transactions must not wait on Cloudinary network requests.

## 7. Mail and environment constraints

- Future Resend integration belongs in MailService; Auth owns recovery tokens, Redis cooldown, expiry and session revocation.
- Keep existing forgot/reset HTTP contracts. Do not add `/send-email` for FE.
- Preserve generic forgot-password responses to avoid account enumeration, including provider failure handling.
- Never log reset links, tokens, email credentials or provider secrets.
- Proposed config: RESEND_API_KEY and MAIL_FROM; install SDK only as part of an approved integration task.
- Keep a single FRONTEND_URL for CORS, trusted origin and reset links. Do not reconstruct trusted email links from client Host/Origin.
- Environment precedence: process/hosting variables → `.env.${NODE_ENV}` → `.env`; absent NODE_ENV selects development. Set NODE_ENV before startup to select production.
- Keep env files untracked. If FE/BE deploy cross-site, explicitly test cookie/SameSite behavior before changing security settings.

## 8. Database work is a separate approval gate

Before any persistence implementation:

1. Confirm the actual DB DDL and migration process, not only schema.ts.
2. Explain proposed additions and backward compatibility.
3. Audit data conflicts (especially pending opposite-direction friend requests).
4. Produce a migration for review; do not modify historical migrations or run reset/push.
5. Obtain explicit permission before applying to any remote database.

Expected proposals: media_uploads plus avatar reference; unordered pending pair uniqueness; notification target/dedupe fields; only necessary pagination indexes.

Do not add new runtime ALTER TABLE statements to DrizzleService startup. Existing startup DDL is legacy behavior, not a pattern to expand during these tasks.

## 9. Per-task implementation workflow

1. Read git status and preserve work already present. Use a dedicated feature/fix branch.
2. Name the module and exact API/function being implemented. Identify dependencies still returning 501.
3. Agree on unresolved contracts/config/schema before coding. Do not silently fill gaps with fabricated endpoints.
4. Implement the smallest coherent slice. Keep unrelated placeholders untouched.
5. Update DTOs/response types/docs only where necessary; surface any breaking API change.
6. Add real success, failure, authorization and concurrency tests appropriate to the slice.
7. Update the skeleton e2e cases for completed routes: they currently expect 501. Do not keep stale 501 assertions or delete coverage just to pass tests.
8. Run targeted checks and report actual results and remaining gaps.
9. Do not commit or push unless the user requests it for the current work.

## 10. Validation and test interpretation

```bash
npm run build
npm test -- --runInBand
npm run test:e2e -- --runInBand
npx eslint <changed-ts-files>
git diff --check
```

- The project lint script runs --fix broadly; avoid reformatting unrelated files.
- `test/api-skeleton.e2e-spec.ts` verifies routes, DTO validation and 401/501 envelopes with mocked DB/token verifier. It does not prove resource authorization, DB constraints or live Cloudinary/Resend behavior.
- Existing auth e2e tests must keep passing. SMTP is intentionally not migrated in this skeleton.
- Use isolated DB integration tests for unique constraints, lock order, rollback and cleanup-vs-attach races once implemented. Never test those invariants only with mocks and claim DB correctness.
- Mock external integrations in unit tests; use approved sandbox accounts for live integration checks.
- Completion report: files/behavior changed, checks actually run, migration/config steps required, remaining placeholders and known limits.
