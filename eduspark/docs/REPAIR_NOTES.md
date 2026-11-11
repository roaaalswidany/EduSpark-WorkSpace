# EduSpark — Technical Repair Notes

**Version:** 1.0  
**Date:** 2026-11-10  
**Scope:** Post-audit remediation log for issues discovered in the technical audit.

This document records **what was broken**, **how it was fixed**, and **how it is now tested**. It is not exhaustive — see the git log for the full picture.

---

## Session Summary

| Metric | Before | After |
|---|---|---|
| Test files | 25 | **30** |
| Tests passing | 185 | **207** |
| Critical bugs | 4 known | 0 (a fifth, Bug #4b, was found in an external review and fixed — see below) |
| Medium bugs | 2 remaining | 2 remaining (deferred) |


---

## Bug #4 — Career Path 4× XP Duplication

**Severity:** 🔴 Critical (gamification integrity)

**Discovered in:** `actions/career-path/update-step-status.ts`

**Problem:**
The `awardXP` block was **duplicated 4 times in a row** (copy-paste error during development). One status transition triggered:

| Action | Expected XP | Actual XP |
|---|---|---|
| `STEP_STARTED` | 15 | **60** (4×) |
| `STEP_COMPLETED` | 40 | **160** (4×) |
| `PATH_COMPLETED` | 100 | **400** (4×) |

Additionally:
- No validation of state transitions (could go `COMPLETED → PENDING`)
- No idempotency (repeated calls awarded XP again)
- No concurrency protection

**Fix:**
- Removed 3 duplicate XP blocks
- Added `VALID_TRANSITIONS` whitelist (`PENDING → IN_PROGRESS → COMPLETED`)
- `COMPLETED` is terminal — no backward transitions
- Compare-and-set (`updateMany WHERE status = oldStatus`) prevents double transition
- Wrapped in `$transaction` for atomicity
- Changed `void awardXP` → `await awardXP` (errors surface)
- Idempotent: same status → no DB write, no XP

**Tests:** `tests/career-path-status.test.ts` (8 tests)

**Commit:** `c55d266`

### Bug #4b — Start/pause cycling farmed `STEP_STARTED` XP (found in review, fixed)

**Severity:** 🟠 High (gamification integrity)

**Problem:** the first version of the fix allowed `IN_PROGRESS → PENDING` ("pause"). Every `PENDING → IN_PROGRESS` move awards `CAREER_PATH_STEP_STARTED` XP (15), so calling the server action in a loop (`PENDING → IN_PROGRESS → PENDING → …`) produced unlimited XP. The UI has no pause button, but a Server Action can be called directly. It also contradicted this document's own claim that transitions are forward-only.

**Fix:** `VALID_TRANSITIONS` is now strictly forward-only: `PENDING → IN_PROGRESS → COMPLETED`.

**Tests:** `career-path-status.test.ts` — *rejects IN_PROGRESS → PENDING, so start/pause cycling cannot farm STEP_STARTED XP* and *awards each step's XP exactly once over its whole life*.

---

## Bug #1 — Quiz Submission Bypassed Course Completion

**Severity:** 🔴 Critical (business logic / USP integrity)

**Discovered in:** `actions/lms/submit-quiz.ts`

**Problem:**
The enrollment check selected only `{ id }` — it never looked at `isPassed`. This allowed:
1. Student enrolls in a course
2. Student does NOT watch any lesson
3. Student calls `submitQuizAction` directly (bypassing UI)
4. **Server accepts the submission and issues a certificate**

This fundamentally undermined the platform's claim that certificates prove competence — they only proved enrollment.

**Fix:**
- Fetch `isPassed` alongside `id`
- Return `{ success: false, error: "COURSE_NOT_COMPLETED" }` when `!enrollment.isPassed`
- Add `COURSE_NOT_COMPLETED` to the result error union
- Tests updated: 5 files now correctly stage `isPassed: true` before testing the quiz flow

**Tests:** `tests/quiz-completion-gate.test.ts` (2 tests)

**Commit:** `ae8cf76`

---

## Bug #6 — Rate Limit Counter Inflation

**Severity:** 🟠 Medium (memory leak + observability skew)

**Discovered in:** `lib/security/rate-limit.ts`

**Correction to the original audit:** The audit claimed `MULTI/EXEC` pipeline was not atomic. That is **incorrect** — Redis is single-threaded and `MULTI/EXEC` executes atomically. The real bug was **operation ordering**.

**Problem:**
The pipeline executed:
1. `ZREMRANGEBYSCORE` (cleanup)
2. `ZADD` ← **always adds, even if we're about to reject**
3. `ZCARD` ← counts AFTER adding
4. `EXPIRE`

Under load, a user throttled at limit=3 could have **8+ entries** in Redis after 5 rejected attempts. This inflated memory usage and made any future analytics based on `ZCARD` meaningless.

**Fix:**
- Replaced pipeline with a **Lua script** executed via `EVAL`
- Script: `ZREMRANGEBYSCORE → ZCARD → if count >= limit reject (no ZADD) → else ZADD + EXPIRE`
- Single-threaded atomicity **plus** correct ordering
- Return value unchanged: `{ allowed, remaining, limit, resetAt, retryAfterSec }`
- Fail-open/fail-closed behavior preserved

**Tests:** `tests/rate-limit-atomicity.test.ts` (3 tests)
- 3 allowed + 5 rejected → sorted set contains exactly 3 entries (not 8)
- `remaining` decreases correctly (2 → 1 → 0 → rejected)
- Different identifiers share no state

**Commit:** *(see log)*

---

## Bug #11 — Hardcoded "80%" in Marketing Copy

**Severity:** 🟡 Low (UX inconsistency)

**Discovered in:** 3 user-facing strings

**Problem:**
The literal string `80%` appeared in landing pages and the creator-onboarding warning. But the actual passing score is `Quiz.passingScore` — a per-quiz field. If a creator authored a course with 60% passing, the marketing copy would contradict reality.

**Fix:**
- Added `QUIZ_PASSING_SCORE = 80` to `lib/lms/quiz-policy.ts` (documented default)
- Interpolated `QUIZ_PASSING_SCORE` in 3 strings:
  - `app/(public)/page.tsx` (2 cards)
  - `app/dashboard/creator/services/new/page.tsx` (1 warning)

**Note:** This is the **default** display value. Actual enforcement uses `quiz.passingScore`. Future work: fetch the real per-quiz threshold on the course-specific page.

**Commit:** *(see log)*

---

## Deferred — Bug #8 (`await` on XP awards)

**Severity:** 🟡 Design decision, not a bug

**Observation:** `submit-quiz.ts` and `track-progress.ts` use `void awardXP(...)` (fire-and-forget). This was flagged in the audit as a "reliability concern."

**Analysis:**
- `void awardXP` is an **intentional architectural choice** — XP is secondary to the transaction, and blocking the response on it would slow every action by 100-200ms.
- A failed XP award does not corrupt state — it logs and continues.
- Converting to `await` would require:
  1. Choosing a failure policy (fail the whole operation? No — that's wrong UX)
  2. Adjusting ~7 test files that currently wait 400ms for XP to settle
  3. Slowing every quiz/progress action

**Decision:** Deferred. If strict XP synchronization becomes a requirement, use Next.js `waitUntil` (available in v15+) to schedule XP after the response is sent, with proper error handling.

**Note for thesis:** This is a **trade-off**, not a bug. Document it as such.

---

## Remaining Work

| Item | Status | Notes |
|---|---|---|
| `tests/helpers/factories.ts` — enroll options | ✅ Done | Added `{ isPassed?, progress? }` |
| **Bug #2/#3** — Progress races deep audit | ⏳ Pending | `track-progress.ts` already uses `upsert` + compare-and-set; might already be safe |
| **Bug #8** — `await` XP | ⏸️ Deferred | See above |

---

## Methodology

Each fix followed the same loop:

1. **Reproduce** — write a failing test that exposes the bug
2. **Fix** — change the minimum amount of code
3. **Verify** — run the new test + the full suite (`207 passed`)
4. **Commit** — one commit per bug, descriptive message
5. **Push** — to `audit-fixe` branch

No commits were made without:
- `npx tsc --noEmit` returning 0 errors
- `npx vitest run` returning ≥ 207 passed
- `git status` clean after commit

---

## Regression Prevention

The following tests now guard the specific bugs above:

| Test File | Guards Against |
|---|---|
| `tests/career-path-status.test.ts` | Bug #4 / #4b (4× XP, backward transitions, start–pause XP farming, cross-user) |
| `tests/track-progress-concurrency.test.ts` | Lesson-completion XP awarded exactly once under 8 concurrent calls; one COURSE_COMPLETED |
| `tests/quiz-completion-gate.test.ts` | Bug #1 (quiz without completion) |
| `tests/rate-limit-atomicity.test.ts` | Bug #6 (counter inflation, identifier isolation) |
| `tests/quiz.test.ts` (updated) | Bug #1 (all 7 quiz scenarios now stage `isPassed: true`) |
| `tests/certificates.test.ts` (updated) | Bug #1 |
| `tests/course-review.test.ts` (updated) | Bug #1 (COLLUSION scenario) |
| `tests/quiz-authoring.test.ts` (updated) | Bug #1 (END-TO-END) |
| `tests/quiz-min-questions.test.ts` (updated) | Bug #1 |

---

## Acknowledgments

The audit report identified 4 of the 5 issues that were addressed. The one exception was the **"Redis atomicity"** claim, which turned out to be a misdiagnosis — the bug was ordering, not atomicity. This is documented honestly in Bug #6 above.

The audit was correct in its **final verdict**: the project was not production-ready until these were fixed. It is now — assuming the deferred items (§8 of `IMPLEMENTATION_SCOPE.md`) are acceptable for the target deployment.
