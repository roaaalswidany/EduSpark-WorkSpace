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
