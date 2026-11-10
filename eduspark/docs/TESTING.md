# Automated Testing Strategy & Results

## Overview
EduSpark implements a comprehensive automated testing suite using **Vitest v3.2.7**. The test suite covers critical business logic, security boundaries, and concurrency edge cases across the platform.

## Test Statistics
- **Total Test Files:** 12
- **Total Tests:** 96
- **Passed:** 89 (100% of executed tests)
- **Skipped:** 7 (Chat E2E tests - require active Socket.io server)
- **Failed:** 0
- **Execution Time:** ~28 seconds
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
- **Atomic Certification:** Passing a quiz (80%+) atomically issues a certificate and upgrades the user to CREATOR.
- **Concurrency:** 10 concurrent quiz submissions result in exactly one certificate.

### 3. Marketplace & Projects (`projects.test.ts`, `reviews.test.ts`)
- **Project Lifecycle:** PENDING -> IN_PROGRESS -> REVIEW_REQUESTED -> COMPLETED with strict actor authorization.
- **Concurrency:** 10 concurrent approvals result in exactly one success (compare-and-set).
- **Order Guarding:** Rejects self-orders and orders from suspended users/creators.
- **Reviews:** Enforces one review per project, validates ratings (1-5 via DB CHECK constraint), and strips control characters.

### 4. Gamification (`gamification.test.ts`, `streak.test.ts`)
- **Atomic XP Awards:** 30 concurrent awards add up exactly (no lost updates).
- **Farming Prevention:** XP is awarded only once per lesson and counted quiz attempt.
- **Streaks:** Calculates and tracks user streaks across time zones.

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


---

## Test Suite Summary

**Last Run:** 2026-11-10  
**Duration:** 163.50s  
**Result:** 185 passed | 7 skipped (192 total)  

### Storage Security Tests (`tests/storage-security.test.ts`)

| # | Test | Risk Mitigated |
|---|------|----------------|
| 1 | blocks the creator from deleting an attachment on a COMPLETED project | Data preservation & audit integrity |
| 2 | blocks an outsider from deleting any attachment | Unauthorized access control |
| 3 | allows the admin to delete an attachment on a COMPLETED project | Admin override authorization |
| 4 | allows the creator (project participant) to get a download URL | Authorized read access |
| 5 | allows the client (project participant) to get a download URL | Authorized read access |
| 6 | blocks a suspended user even if they are a participant | Session invalidation on suspension |