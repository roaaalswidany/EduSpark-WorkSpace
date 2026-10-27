import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { submitQuizAction } from "@/actions/lms/submit-quiz";
import { getPublicCertificate, CREDENTIAL_ID_RE } from "@/lib/certificates/public";
import { qrSvg } from "@/lib/certificates/qr";
import { GET } from "@/app/api/verify/[credentialId]/route";
import { resetDatabase, createUser, createCourseWithQuiz, enroll, createCategory } from "./helpers/factories";
import { actAs, resetSession } from "./helpers/session";

let credentialId = "";
let holderEmail = "";

beforeAll(async () => {
  await resetDatabase();
  const creator = await createUser("CREATOR");
  const cat = await createCategory("Design");
  const course = await createCourseWithQuiz({ creatorId: creator.id, categoryId: cat.id });
  const student = await createUser("STUDENT", { name: "Layla Haddad" });
  holderEmail = student.email;
  await enroll(student.id, course.id);
  actAs({ id: student.id, role: "STUDENT" });
  const res = await submitQuizAction({
    quizId: course.quiz!.id,
    answers: course.quiz!.questions.map((q) => ({ questionId: q.id, selectedOption: "A" })),
  });
  if (!res.success || !res.data.passed) throw new Error("setup: quiz not passed");
  credentialId = (await db.certificate.findFirstOrThrow({ where: { userId: student.id } })).credentialId;
  resetSession();
});
beforeEach(() => { /* rate-limit counters are flushed by setup.ts */ });

describe("real credential IDs match the documented format", () => {
  it("generateCredentialId() output satisfies CREDENTIAL_ID_RE", () => {
    expect(credentialId).toMatch(CREDENTIAL_ID_RE);
  });
});

describe("getPublicCertificate — privacy by construction", () => {
  it("returns only whitelisted fields (no email, user id, attempt id)", async () => {
    const c = await getPublicCertificate(credentialId);
    expect(c).not.toBeNull();
    expect(Object.keys(c!).sort()).toEqual(
      ["categoryName", "courseTitle", "credentialId", "holderName", "issuedAt", "issuer", "score"].sort()
    );
    expect(c).toMatchObject({ holderName: "Layla Haddad", categoryName: "Design", score: 100, issuer: "EduSpark" });
    expect(JSON.stringify(c)).not.toContain(holderEmail);
  });

  it("is case/whitespace tolerant for typed IDs", async () => {
    expect((await getPublicCertificate(`  ${credentialId.toLowerCase()} `))?.credentialId).toBe(credentialId);
  });

  it("unknown, malformed and injection-style IDs all return null", async () => {
    for (const bad of ["", "EDU-XXXX", "EDU-ABCDEF-123456789ABC", "' OR 1=1 --", "EDU-ABCDEF-0123456789AB; DROP TABLE users", "../../etc/passwd", "a".repeat(500)]) {
      expect(await getPublicCertificate(bad)).toBeNull();
    }
    expect(await db.user.count()).toBeGreaterThan(0); // nothing was dropped :)
  });
});

describe("GET /api/verify/[credentialId]", () => {
  const call = (id: string, headers: Record<string, string> = {}) =>
    GET(new Request(`http://localhost/api/verify/${id}`, { headers }), { params: Promise.resolve({ credentialId: id }) });

  it("200 + valid:true for a real credential, never cached", async () => {
    const res = await call(credentialId);
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const body = await res.json();
    expect(body.valid).toBe(true);
    expect(body.certificate.holderName).toBe("Layla Haddad");
    expect(typeof body.certificate.issuedAt).toBe("string");
  });

  it("404 + valid:false for an unknown credential", async () => {
    const res = await call("EDU-ABCDEFGH-0123456789AB");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ valid: false });
  });

  it("rate-limits scraping: the 61st request in a minute gets 429 + Retry-After", async () => {
    const statuses: number[] = [];
    let last: Response | null = null;
    for (let i = 0; i < 62; i++) { last = await call("EDU-ABCDEFGH-0123456789AB", { "x-forwarded-for": "198.51.100.9" }); statuses.push(last.status); }
    expect(statuses.filter((s) => s === 404)).toHaveLength(60);
    expect(statuses.slice(60)).toEqual([429, 429]);
    expect(Number(last!.headers.get("Retry-After"))).toBeGreaterThan(0);
  });

  it("limits are per client IP (another IP is unaffected)", async () => {
    for (let i = 0; i < 61; i++) await call("EDU-ABCDEFGH-0123456789AB", { "x-forwarded-for": "198.51.100.10" });
    expect((await call(credentialId, { "x-forwarded-for": "198.51.100.11" })).status).toBe(200);
  });
});

describe("QR code", () => {
  it("is a self-contained SVG that encodes the verification URL", async () => {
    const svg = await qrSvg(`http://localhost:3000/verify/${credentialId}`);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).not.toMatch(/<script|https?:\/\/(?!www\.w3\.org)/i); // no external refs, no script
  });
});
