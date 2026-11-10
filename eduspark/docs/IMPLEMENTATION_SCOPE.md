# EduSpark — Implementation Scope

**Version:** 1.0  
**Last Updated:** 2026-11-10  
**Purpose:** Authoritative reference of what is *actually* implemented in the codebase, what is partial, and what is deferred to future phases. Prevents misrepresentation in demos, documentation, and the thesis defense.

---

## Legend

- ✅ **Implemented** — Full lifecycle, server-enforced, tested
- 🟡 **Partial** — Basic flow works; advanced features deferred
- ⏸️ **Deferred** — Schema may exist (prepared), but no business logic
- ❌ **Out of Scope** — Not part of this project

---

## 1. Learning Management (LMS)

| Feature | Status | Notes |
|---|---|---|
| Course creation (creator) | ✅ | DRAFT → PENDING_REVIEW → PUBLISHED |
| Course review gate (admin) | ✅ | Only admin can move PENDING_REVIEW → PUBLISHED |
| Curriculum editor (sections/lessons) | ✅ | Frozen while course is PENDING_REVIEW for the owner |
| Course thumbnail upload | ✅ | Byte-sniffed (PNG/JPEG/WebP), 2MB cap, rate-limited 20/hr |
| Enrollment (free + paid flow) | ✅ | Paid flow records amount but no gateway integration |
| Lesson completion tracking | ✅ | Student-triggered; not video-playback-verified (see §6) |
| Course progress calculation | ✅ | Recomputed transactionally with row lock |
| Course completion transition | ✅ | Compare-and-set on `isPassed`, XP awarded once |
| Curriculum accordion (student view) | ✅ | Free preview support |

---

## 2. Quiz & Certification

| Feature | Status | Notes |
|---|---|---|
| Manual quiz authoring | ✅ | Creator authors questions (draft/published status) |
| AI quiz generation (Gemini) | ✅ | 10/hour, guards run before any paid AI call |
| Minimum quiz size for certification | ✅ | `QUIZ_MIN_QUESTIONS_FOR_CERTIFICATION = 4` |
| Quiz attempt limit | ✅ | 3 per 24h per user (row-lock serialized) |
| **Course completion gate** | ✅ | **Enforced server-side: `COURSE_NOT_COMPLETED` rejection** |
| Passing score | ✅ | Per-quiz (`Quiz.passingScore`), default 80% |
| Answer key leak prevention | ✅ | Feedback returned only after passing |
| Certificate issuance | ✅ | Idempotent (`@@unique([userId, courseId])`) |
| STUDENT → CREATOR upgrade | ✅ | Conditional `updateMany` prevents double-escalation |
| Credential ID format | ✅ | `EDU-<base36-timestamp>-<random-hex>` |
| Public certificate verification | ✅ | `/verify/[credentialId]` + JSON API, 60 req/min |
| QR code for certificate | ✅ | Self-contained SVG |

---

## 3. Marketplace (Gated)

| Feature | Status | Notes |
|---|---|---|
| Service creation | ✅ | New services start as `PENDING_REVIEW` |
| Admin service review | ✅ | Approve / Request changes (with reason) |
| Service edit → re-review | ✅ | Owner edits require re-approval for title/desc/links |
| Service thumbnail upload | ✅ | Same hardening pipeline as courses |
| Service activation | ✅ | Only admin can move PENDING_REVIEW → ACTIVE |
| Owner withdraw submission | ✅ | PENDING_REVIEW → PAUSED |
| Catalog filtering/sort | ✅ | Category, price, search, sort |
| Related services | ✅ | Same category, ordered |

---

## 4. Project Workflow (Client ↔ Creator)

| Feature | Status | Notes |
|---|---|---|
| Service ordering | ✅ | Creates project + milestones + chat room atomically |
| Milestone lifecycle | ✅ | PENDING → IN_PROGRESS → REVIEW_REQUESTED → APPROVED |
| Delivery submission | ✅ | Note (≤2000 chars) + URL (https-only, ≤500 chars) |
| Revision request flow | ✅ | Client can request changes with ≥10 char note |
| Project completion | ✅ | Client approves; status → COMPLETED |
| Project reviews | ✅ | Only client of COMPLETED project; immutable; notifies creator |
| **Financial settlement** | ⏸️ | **See §7 — money is recorded, not moved** |

---

## 5. Real-time & Notifications

| Feature | Status | Notes |
|---|---|---|
| Socket.IO chat | ✅ | Redis adapter for horizontal scaling |
| Chat room auto-provisioning | ✅ | Created with each project/order |
| System messages | ✅ | Milestone events, project completion |
| In-app notifications | ✅ | Real-time via Socket.IO |
| Email (SMTP fallback) | ✅ | EmailJS → SMTP chain |
| Email verification | ✅ | Token single-use, expires |
| Password reset | ✅ | Token single-use, rate-limited (5/hour) |

---

## 6. Gamification

| Feature | Status | Notes |
|---|---|---|
| XP system | ✅ | Awarded on lesson, course, quiz, career path events |
| Levels (Bronze → Platinum) | ✅ | Thresholds in `lib/gamification/levels.ts` |
| Badges | ✅ | 15+ catalog entries, idempotent `upsert` |
| Streaks (daily activity) | ✅ | Persisted; 7-day badge earnable |
| Leaderboard | ✅ | Top 20 by XP, initials-only avatars |
| Career paths | ✅ | AI-generated roadmap + state machine |
| **Career path transitions** | ✅ | **Forward-only, `COMPLETED` terminal, idempotent** |
| Anti-farming | ✅ | XP only on real transitions; retakes after certification earn nothing |

---

## 7. Deferred — Financial System

The following are **explicitly deferred** to a future phase. Fields exist in the schema as *preparation*, not implementation.

| Feature | Status | Schema | Business Logic |
|---|---|---|---|
| Payment gateway integration | ⏸️ | — | ❌ |
| Escrow transactions | ⏸️ | `Project.escrowAmount` (nullable) | ❌ |
| Wallet management | ⏸️ | `UserStats` (XP only) | ❌ |
| Refund processing | ⏸️ | — | ❌ |
| Financial dispute resolution | ⏸️ | `ProjectStatus.DISPUTED` (enum) | ❌ |

**Important:** `Project.escrowAmount` and `Order.totalAmount` are recorded but **never debited from a real payment method** nor **credited to a creator**. Any marketing or thesis text must not claim payment processing.

---

## 8. Known Limitations

### 8.1 Video Playback Verification

**Current:** Lesson completion is triggered by the student (button click after watching). The system trusts this signal.

**Impact:** A student who clicks through without watching still advances.

**Fix required:** Server-side playback analytics (YouTube API / Vimeo / self-hosted with signed time-tokens).

### 8.2 MinIO CORS

MinIO does not support `PutBucketCors` via the S3 API. For production deployments where the browser and storage are on different origins, CORS must be configured at the server level:

```yaml
# docker-compose.yml
minio:
  environment:
    MINIO_API_CORS_ALLOW_ORIGIN: "https://yourdomain.com"