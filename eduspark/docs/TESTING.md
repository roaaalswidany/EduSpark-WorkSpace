# Automated Testing Strategy & Results

## Overview
EduSpark implements a comprehensive automated testing suite using **Vitest v3.2.7**. The test suite covers critical business logic, security boundaries, and concurrency edge cases across the platform.

## Test Statistics
- **Total Test Files:** 30 (29 executed, 1 skipped) — static count
- **Total Tests:** 214 — static count (207 expected to pass + 7 skipped)
- **Skipped:** 7 (Chat E2E tests - require an active Socket.io server and `CHAT_E2E_URL`)
- **Last measured full run:** 2026-11-11 — 30 files, 214 tests (207 passed, 7 skipped, 0 failed), 139.93 s.
- **Test Database:** PostgreSQL (isolated `eduspark_test` database)
- **Rate Limiting:** Enabled via Redis (isolated `db 1`)

## Test Coverage by Module

### 1. Authentication & Security (`security.test.ts`)
- JWT tampering prevention (rejecting client-supplied roles)
- Role escalation prevention (STUDENT -> CREATOR/ADMIN)
- Rate limiting per IP for sign-ups (3/hour)
- Stale JWT handling for demoted users
- Re-validation of database roles for privileged actions

### 2. LMS Core (`bootstrap.test.ts`, `quiz.test.ts`, `quiz-authoring.test.ts`)
- **Idempotency:** The bootstrap script runs multiple times without duplicating data.
- **Quiz Attempts:** Enforces a maximum of 3 attempts per 24 hours.
- **Answer Key Privacy:** Correct answers are not leaked to the client on failed attempts.
- **Atomic Certification:** Passing a quiz (80%+) atomically issues a certificate and upgrades the user to CREATOR — but only for a course an administrator approved (see §9) and whose quiz has at least 4 questions (§10).
- **Concurrency:** 10 concurrent quiz submissions result in exactly one certificate.

### 3. Marketplace & Projects (`projects.test.ts`, `reviews.test.ts`)
- **Project Lifecycle:** PENDING -> IN_PROGRESS -> REVIEW_REQUESTED -> COMPLETED with strict actor authorization.
- **Concurrency:** 10 concurrent approvals result in exactly one success (compare-and-set).
- **Order Guarding:** Rejects self-orders and orders from suspended users/creators.
- **Reviews:** Enforces one review per project, validates ratings (1-5 via DB CHECK constraint), and strips control characters.

### 4. Gamification (`gamification.test.ts`, `streak.test.ts`)
- **Atomic XP Awards:** 30 concurrent awards add up exactly (no lost updates).
- **Farming Prevention:** XP is awarded only once per lesson and counted quiz attempt.
- **Streaks:** Calculates and persists streaks (same day, next day, gap reset) and is robust at the UTC midnight boundary.

### 5. Certificates (`certificates.test.ts`)
- **Public Verification API:** Returns only whitelisted fields (no email, user ID, or attempt ID).
- **QR Code:** Generates a self-contained SVG encoding the verification URL.
- **Scraping Prevention:** Rate limits the verification endpoint (60 requests/minute per IP).

### 6. Email System (`email.test.ts`)
- **Verification Flow:** Sign-up emails a link; token is single-use.
- **Password Reset:** Answers identically for known/unknown emails (prevents enumeration).
- **Rate Limiting:** Prevents mail-bombing (5 requests/hour per email).

### 7. Seed Safety (`seed-guard.test.ts`)
- **Fail-Closed Design:** Prevents the demo seed from accidentally hitting a production database or a remote host.
- **Repository Hygiene:** Scans for leaked secrets and personal email addresses.

### 8. Storage Security (`storage-security.test.ts` — 6 tests)

| # | Test | Risk mitigated |
|---|------|----------------|
| 1 | blocks the creator from deleting an attachment on a COMPLETED project | Evidence/audit integrity after delivery |
| 2 | blocks an outsider from deleting any attachment | Unauthorized access control |
| 3 | allows the admin to delete an attachment on a COMPLETED project | Admin moderation override |
| 4 | allows the creator (project participant) to get a download URL | Authorized read access |
| 5 | allows the client (project participant) to get a download URL | Authorized read access |
| 6 | blocks a suspended user even if they are a participant | A still-valid session of a suspended account |

### 9. Course Review Gate (`course-review.test.ts` — 13 tests)
- A creator can never publish directly: submitting moves DRAFT → PENDING_REVIEW exactly once (compare-and-set); only an administrator publishes.
- Submission is refused for an empty course and for a quiz below the minimum size.
- Only a real admin can decide (creator, student, forged-ADMIN JWT and anonymous are refused; the role is read from the database).
- Approval records the reviewer and writes an audit entry, a notification and an email; rejection needs a note of at least 10 characters, returns the course to DRAFT, and resubmitting clears it.
- 5 concurrent approvals record exactly one decision.
- The quiz is frozen once the course leaves DRAFT (creator), and the curriculum is frozen while under review.
- **Collusion scenario:** a course nobody approved can never issue a certificate or a CREATOR role; after approval it can.

### 10. Certification Quiz Size (`quiz-min-questions.test.ts` — 3 tests)
- A quiz below the minimum cannot certify; a published course cannot get a quiz added afterwards; a quiz with exactly the minimum still certifies.

### 11. Course Reviews & Milestone Delivery Links (`course-reviews.test.ts` — 7, `milestone-submission.test.ts` — 5)
- Ratings need a real learner: active account, published course, not the creator's own, at least 25 % progress, rate-limited (10/hour).
- 6 concurrent submissions by one student yield one review; 8 simultaneous students leave the stored count and average equal to the rows.
- Delivery links must be `https://` (javascript:, data:, file: and plain http are refused) and are size-bounded; the milestone stays IN_PROGRESS when input is invalid.

### 12. Thumbnail Uploads (`thumbnail-upload.test.ts` — 11, `service-thumbnail.test.ts` — 8)
- The image type is detected from the file bytes (PNG/JPEG/WebP), never from the browser-declared type; HTML/SVG disguised as an image is refused before touching storage.
- Files are stored only under the `public/` prefix; 2 MB limit; owner/admin only; suspended owner refused; frozen while under review; the previous image is deleted after a successful replacement; 20 uploads/hour.

### 13. Service Review Gate (`service-review.test.ts` — 12, `service-edit-review.test.ts` — 7)
- A creator can never activate a service: the allowed moves are fixed on the server and every other transition (including PENDING_REVIEW → PAUSED → ACTIVE and un-archiving an admin-archived service) is refused.
- Admin approval/rejection (rejection pauses the service with a note), concurrent decisions record one, and a pending service cannot be ordered until approved.
- Editing an approved service's title, description or links sends it back to review; price, delivery time, revisions and tags do not.

### 14. Service Creation & Link Scanning (`service-write.test.ts` — 9, `virustotal.test.ts` — 11, `service-links.test.ts` — 2)
- Role, e-mail verification and certificate checks; category derived from the certificate; unique slugs; https-only portfolio links; VirusTotal blocks malicious URLs and fails open on error/timeout (an advisory check, not a security boundary).

### 15. Rate-limit Failure Modes (`rate-limit-fail-closed.test.ts` — 2 tests)
- With Redis unavailable the limiter fails open by default and fails closed when `RATE_LIMIT_FAIL_CLOSED=true`.

### 16. Public Object URLs (`public-objects.test.ts` — 6 tests)
- URLs are built as `<public url>/<bucket>/<key>`; a bucket already present in `S3_PUBLIC_URL` is not doubled; parsing is the exact inverse; foreign hosts and path traversal are never treated as ours.

### 17. Course Completion Gate (`quiz-completion-gate.test.ts` — 2 tests)
- A certification quiz is refused (server-side) until the learner has completed every lesson of the course (`Enrollment.isPassed`); once the course is completed the same submission is accepted.

### 18. Career Path Integrity (`career-path-status.test.ts` — 8 tests)
- Steps move strictly forward (PENDING → IN_PROGRESS → COMPLETED); backwards moves and PENDING → COMPLETED are refused; same-status calls are idempotent and award no XP.
- 8 concurrent transitions: exactly one succeeds (no double XP); one user cannot update another user's step.
- Start/pause cycling cannot farm `STEP_STARTED` XP, and each step's XP is awarded exactly once over its whole life.

### 19. Rate-limit Atomicity (`rate-limit-atomicity.test.ts` — 3 tests)
- Rejected requests do not increase the stored counter (a blocked client does not extend its own lockout); successful requests increment; different identifiers share no state.

### 20. Progress Tracking Under Concurrency (`track-progress-concurrency.test.ts` — 3 tests)
- 8 concurrent completions of the same lesson award its XP exactly once; concurrent completions across all lessons reach 100 % with a single COURSE_COMPLETED; calls after completion award nothing new.

### Chat E2E (`chat-e2e.test.ts` — 7 tests, skipped)
- Requires the Socket.io server and `CHAT_E2E_URL`; **not executed** in the figures above.

## Handling Concurrency (Race Conditions)
A key focus of the test suite is ensuring system stability under high concurrency:
- **Enrollment:** 8 concurrent enrollments result in 1 enrollment row and 1 chat room.
- **Certificates:** Concurrent passing submissions create exactly one certificate.
- **Projects:** Concurrent approvals result in exactly one project completion.
This is achieved using PostgreSQL transactions ($transaction), row-level locking, and unique constraints with P2002 error handling.

## How to Run Tests
1. Ensure PostgreSQL and Redis are running via Docker (npm run infra:up).
2. Run the test suite:
   cd eduspark
   npm run test

---

## Load Test Results (Production Build)

**Test Date:** 2026-11-07  
**Environment:** Local Docker (PostgreSQL 16, MinIO/SILO, Redis 7) + `npm run build && npm start`  
**Tool:** k6 v2.3.0  
**Script:** `load-test.js`

### Command

```bash
k6 run -e BASE_URL=http://localhost:3000 \
  --summary-export=load-results.json \
  load-test.js
```

### Results (`load-results.json`)

| Metric | Result | Threshold |
|---|---|---|
| Requests | 2,850 over ~50 s (≈ 56 req/s) | — |
| Concurrent virtual users | 50 (peak) | — |
| Failed requests (`http_req_failed`) | **0 %** | < 1 % ✅ |
| Checks passed (status 200 on `/`, `/marketplace`, `/courses`) | **100 %** (2,850 / 2,850) | > 99 % ✅ |
| Response time — average | 163.6 ms | — |
| Response time — median | 56.3 ms | — |
| Response time — p90 | 444.1 ms | — |
| Response time — **p95** | **649.9 ms** | < 1,500 ms ✅ |
| Response time — max | 1,188.5 ms | — |

### What this does and does not show

- It shows that the three **public, read-only pages** stay fast and error-free at 50 concurrent users on a production build.
- It does **not** exercise logged-in flows or writes (quiz submission transaction, enrolment, chat, uploads) — those are covered for *correctness under concurrency* by the test suite, not for *throughput*.
- It ran on a developer machine with PostgreSQL, Redis and MinIO in Docker on the same host, so absolute numbers are indicative only; a real deployment will differ.
