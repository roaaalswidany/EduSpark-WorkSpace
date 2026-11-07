import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from "vitest";
import { db } from "@/lib/db";
import { s3Client } from "@/lib/s3-client";
import { updateCourseThumbnailAction } from "@/actions/creator/update-course-thumbnail";
import { sniffImage, publicObjectUrl, keyFromPublicUrl, PUBLIC_PREFIX } from "@/lib/storage/public-objects";
import { resetDatabase, createUser, createCourseWithQuiz } from "./helpers/factories";
import { actAs, resetSession } from "./helpers/session";

// No real network calls: S3 is mocked; we inspect the commands the action sends.
vi.mock("@/lib/s3-client", () => ({
  s3Client: { send: vi.fn().mockResolvedValue({}) },
  UPLOAD_BUCKET: "test-bucket",
}));

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 1, 2, 3, 4];
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 2, 3];
const WEBP = [0x52, 0x49, 0x46, 0x46, 9, 9, 9, 9, 0x57, 0x45, 0x42, 0x50, 1, 2];
const bytes = (a: number[]) => new Uint8Array(a);
const text = (s: string) => new TextEncoder().encode(s.padEnd(32, " "));

function form(courseId: string, content: Uint8Array, declaredType = "image/png", name = "cover.png") {
  const fd = new FormData();
  fd.append("file", new File([content as BlobPart], name, { type: declaredType }));
  fd.append("courseId", courseId);
  return fd;
}
const sent = () => (s3Client.send as unknown as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0] as { constructor: { name: string }; input: Record<string, unknown> });
const puts = () => sent().filter((c) => c.constructor.name === "PutObjectCommand");
const deletes = () => sent().filter((c) => c.constructor.name === "DeleteObjectCommand");

beforeAll(() => {
  vi.stubEnv("S3_PUBLIC_URL", "https://cdn.example.test/");
  vi.stubEnv("S3_PUBLIC_BUCKET", "test-bucket");
});
afterAll(() => vi.unstubAllEnvs());

let creator: Awaited<ReturnType<typeof createUser>>;
let courseId: string;

beforeEach(async () => {
  resetSession();
  await resetDatabase();
  vi.mocked(s3Client.send).mockClear();
  creator = await createUser("CREATOR");
  courseId = (await createCourseWithQuiz({ creatorId: creator.id })).id;
});
const asCreator = () => actAs({ id: creator.id, role: "CREATOR" });

describe("sniffImage — trusts the bytes, not the browser", () => {
  it("recognises PNG, JPEG and WebP", () => {
    expect(sniffImage(bytes(PNG))).toEqual({ mime: "image/png", ext: "png" });
    expect(sniffImage(bytes(JPEG))).toEqual({ mime: "image/jpeg", ext: "jpg" });
    expect(sniffImage(bytes(WEBP))).toEqual({ mime: "image/webp", ext: "webp" });
  });
  it("rejects SVG, HTML, GIF, PDF, RIFF-but-not-WebP and tiny buffers", () => {
    for (const bad of [
      text("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>"),
      text("<!doctype html><script>alert(1)</script>"),
      text("GIF89a......"),
      text("%PDF-1.7 fake"),
      bytes([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x41, 0x56, 0x49, 0x20, 0, 0]), // RIFF…AVI
      bytes([0x89, 0x50]),
    ]) {
      expect(sniffImage(bad)).toBeNull();
    }
  });
});

describe("public URL helpers", () => {
  it("builds and parses path-style URLs under the public prefix", () => {
    const key = `${PUBLIC_PREFIX}courses/abc/thumbnail-1.png`;
    expect(publicObjectUrl(key)).toBe(`https://cdn.example.test/test-bucket/${key}`);
    expect(keyFromPublicUrl(publicObjectUrl(key))).toBe(key);
    expect(keyFromPublicUrl("https://evil.example/test-bucket/" + key)).toBeNull();
    expect(keyFromPublicUrl(null)).toBeNull();
  });
});

describe("updateCourseThumbnailAction", () => {
  it("stores a valid image under public/, with the DETECTED content type, and saves the public URL", async () => {
    asCreator();
    // declared as JPEG but the bytes are PNG → the detected type wins
    const res = await updateCourseThumbnailAction(form(courseId, bytes(PNG), "image/jpeg", "cover.jpg"));
    expect(res.success).toBe(true);
    const put = puts()[0];
    expect(put.input.Key).toMatch(new RegExp(`^public/courses/${courseId}/thumbnail-[0-9a-f-]{36}\\.png$`));
    expect(put.input.ContentType).toBe("image/png");
    const course = await db.course.findUniqueOrThrow({ where: { id: courseId } });
    expect(course.thumbnail).toBe(publicObjectUrl(put.input.Key as string));
  });

  it("refuses HTML/SVG disguised as an image, and non-image declared types, without touching storage", async () => {
    asCreator();
    expect(await updateCourseThumbnailAction(form(courseId, text("<svg onload=alert(1)>"), "image/png", "x.png"))).toMatchObject({ success: false, error: "INVALID_TYPE" });
    expect(await updateCourseThumbnailAction(form(courseId, text("<!doctype html><script>1</script>"), "image/png", "x.png"))).toMatchObject({ success: false, error: "INVALID_TYPE" });
    expect(puts()).toHaveLength(0);
    expect((await db.course.findUniqueOrThrow({ where: { id: courseId } })).thumbnail).toBeNull();
  });

  it("refuses files over 2MB", async () => {
    asCreator();
    const big = new Uint8Array(2 * 1024 * 1024 + 1); big.set(PNG);
    expect(await updateCourseThumbnailAction(form(courseId, big))).toMatchObject({ success: false, error: "FILE_TOO_LARGE" });
    expect(puts()).toHaveLength(0);
  });

  it("refuses: anonymous, another creator, a suspended owner, a malformed course id", async () => {
    actAs(null);
    expect(await updateCourseThumbnailAction(form(courseId, bytes(PNG)))).toMatchObject({ success: false, error: "UNAUTHORIZED" });
    const other = await createUser("CREATOR"); actAs({ id: other.id, role: "CREATOR" });
    expect(await updateCourseThumbnailAction(form(courseId, bytes(PNG)))).toMatchObject({ success: false, error: "FORBIDDEN" });
    await db.user.update({ where: { id: creator.id }, data: { isActive: false } });
    asCreator();
    expect(await updateCourseThumbnailAction(form(courseId, bytes(PNG)))).toMatchObject({ success: false, error: "FORBIDDEN" });
    await db.user.update({ where: { id: creator.id }, data: { isActive: true } });
    expect(await updateCourseThumbnailAction(form("not-a-cuid", bytes(PNG)))).toMatchObject({ success: false, error: "NOT_FOUND" });
    expect(puts()).toHaveLength(0);
  });

  it("is frozen while the course is under review for the owner, but an admin may still change it", async () => {
    await db.course.update({ where: { id: courseId }, data: { status: "PENDING_REVIEW" } });
    asCreator();
    expect(await updateCourseThumbnailAction(form(courseId, bytes(JPEG), "image/jpeg", "a.jpg"))).toMatchObject({ success: false, error: "COURSE_LOCKED" });
    const admin = await createUser("ADMIN"); actAs({ id: admin.id, role: "ADMIN" });
    expect((await updateCourseThumbnailAction(form(courseId, bytes(WEBP), "image/webp", "a.webp"))).success).toBe(true);
  });

  it("deletes the previous image after a successful replacement (best-effort cleanup)", async () => {
    const oldKey = `${PUBLIC_PREFIX}courses/${courseId}/thumbnail-old.png`;
    await db.course.update({ where: { id: courseId }, data: { thumbnail: publicObjectUrl(oldKey) } });
    asCreator();
    expect((await updateCourseThumbnailAction(form(courseId, bytes(PNG)))).success).toBe(true);
    expect(deletes().map((d) => d.input.Key)).toEqual([oldKey]);
  });

  it("an external thumbnail URL is never deleted from our bucket", async () => {
    await db.course.update({ where: { id: courseId }, data: { thumbnail: "https://images.unsplash.com/photo-1" } });
    asCreator();
    expect((await updateCourseThumbnailAction(form(courseId, bytes(PNG)))).success).toBe(true);
    expect(deletes()).toHaveLength(0);
  });

  it("is rate-limited (20/hour per user): the 21st upload is refused", async () => {
    asCreator();
    let last;
    for (let i = 0; i < 21; i++) last = await updateCourseThumbnailAction(form(courseId, bytes(PNG)));
    expect(last).toMatchObject({ success: false, error: "RATE_LIMITED" });
  });
});
