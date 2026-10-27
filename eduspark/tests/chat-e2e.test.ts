/**
 * Real-time chat END-TO-END: real chat server (production bundle), real Postgres/Redis, real WebSockets.
 * Skipped unless CHAT_E2E_URL is set (see tests/README.md) so `npm test` stays self-contained.
 *   CHAT_E2E_URL=http://localhost:3001 JWT_SECRET=<same as the server> INTERNAL_API_SECRET=<same> npm test
 */
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { io, type Socket } from "socket.io-client";
import jwt from "jsonwebtoken";
import { db } from "@/lib/db";
import { resetDatabase, createUser } from "./helpers/factories";

const URL_ = process.env.CHAT_E2E_URL;
const SECRET = process.env.JWT_SECRET ?? "";
const INTERNAL = process.env.INTERNAL_API_SECRET ?? "";

const token = (u: { id: string; role: string }, o: { secret?: string; expiresIn?: number | string; alg?: jwt.Algorithm } = {}) =>
  jwt.sign({ sub: u.id, email: `${u.id}@t.l`, name: "T", role: u.role, picture: null }, o.secret ?? SECRET,
    { algorithm: o.alg ?? "HS256", expiresIn: (o.expiresIn ?? 3600) as never });

const sockets: Socket[] = [];
function connect(auth: Record<string, unknown>): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const s = io(URL_!, { auth, transports: ["websocket"], reconnection: false, timeout: 5000 });
    sockets.push(s);
    s.on("connect", () => resolve(s));
    s.on("connect_error", (e) => reject(e));
  });
}
const rpc = <T = { ok: boolean; error?: { code: string } }>(s: Socket, ev: string, payload: unknown) =>
  new Promise<T>((resolve) => s.emit(ev, payload, (r: T) => resolve(r)));
const waitFor = <T>(s: Socket, ev: string, ms = 3000) =>
  new Promise<T | null>((resolve) => { const t = setTimeout(() => resolve(null), ms); s.once(ev, (d: T) => { clearTimeout(t); resolve(d); }); });

describe.skipIf(!URL_)("chat server E2E (real WebSockets)", () => {
  let a: Awaited<ReturnType<typeof createUser>>, b: typeof a, outsider: typeof a, roomId: string;
  const key = () => `chat:${roomId}`;   // canonical room key returned by join_room and required by send_message

  beforeAll(async () => {
    await resetDatabase();
    [a, b, outsider] = [await createUser("STUDENT"), await createUser("STUDENT"), await createUser("STUDENT")];
    const creator = await createUser("CREATOR");
    const slug = `chat-${Date.now()}`;
    const course = await db.course.create({ data: { title: slug, slug, description: "d", price: 0, status: "PUBLISHED", creatorId: creator.id } });
    const room = await db.chatRoom.create({ data: { type: "COURSE", courseId: course.id } });
    roomId = room.id;
    await db.chatRoomParticipant.createMany({ data: [{ userId: a.id, chatRoomId: roomId }, { userId: b.id, chatRoomId: roomId }] });
  });
  afterEach(() => { while (sockets.length) sockets.pop()!.disconnect(); });

  it("rejects connections with no token, a wrong-secret token, an expired token and an alg=none token", async () => {
    await expect(connect({})).rejects.toBeTruthy();
    await expect(connect({ token: token(a, { secret: "x".repeat(40) }) })).rejects.toBeTruthy();
    await expect(connect({ token: token(a, { expiresIn: -10 }) })).rejects.toBeTruthy();
    const none = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url") + "." +
      Buffer.from(JSON.stringify({ sub: a.id, role: "ADMIN", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url") + ".";
    await expect(connect({ token: none })).rejects.toBeTruthy();
  });

  it("members join; an outsider cannot join", async () => {
    const sa = await connect({ token: token(a) });
    expect((await rpc(sa, "join_room", { roomId })).ok).toBe(true);
    const so = await connect({ token: token(outsider) });
    const r = await rpc(so, "join_room", { roomId });
    expect(r.ok).toBe(false);
  });

  it("a message from A reaches B in real time AND is persisted", async () => {
    const [sa, sb] = [await connect({ token: token(a) }), await connect({ token: token(b) })];
    await rpc(sa, "join_room", { roomId }); await rpc(sb, "join_room", { roomId });
    const incoming = waitFor<{ content: string }>(sb, "message_new");
    const ack = await rpc<{ ok: boolean }>(sa, "send_message", { roomId: key(), content: "hello <b>team</b>", tempId: "t-1" });
    expect(ack.ok).toBe(true);
    expect((await incoming)?.content).toBe("hello <b>team</b>");      // stored/transported verbatim; React escapes on render
    await new Promise((r) => setTimeout(r, 400));
    expect(await db.chatMessage.count({ where: { chatRoomId: roomId, content: "hello <b>team</b>" } })).toBe(1);
  });

  it("an outsider cannot send into the room, even without joining; nothing is stored", async () => {
    const before = await db.chatMessage.count({ where: { chatRoomId: roomId } });
    const so = await connect({ token: token(outsider) });
    const r = await rpc(so, "send_message", { roomId: key(), content: "let me in", tempId: "x-1" });
    expect(r).toMatchObject({ ok: false, error: { code: "NOT_IN_ROOM" } });          // must join first…
    expect((await rpc(so, "join_room", { roomId })).ok).toBe(false);                  // …and joining requires membership
    expect((await rpc(so, "send_message", { roomId: key(), content: "again", tempId: "x-2" })).ok).toBe(false);
    await new Promise((res) => setTimeout(res, 300));
    expect(await db.chatMessage.count({ where: { chatRoomId: roomId } })).toBe(before);
  });

  it("membership is re-checked on EVERY message: a participant removed after joining is refused", async () => {
    const sb = await connect({ token: token(b) });
    await rpc(sb, "join_room", { roomId });
    expect((await rpc(sb, "send_message", { roomId: key(), content: "still here", tempId: "b-1" })).ok).toBe(true);
    await db.chatRoomParticipant.deleteMany({ where: { chatRoomId: roomId, userId: b.id } });
    const ghost = await rpc(sb, "send_message", { roomId: key(), content: "ghost message", tempId: "b-2" });
    expect(ghost.ok).toBe(false);
    await new Promise((r) => setTimeout(r, 300));
    expect(await db.chatMessage.count({ where: { chatRoomId: roomId, content: "ghost message" } })).toBe(0);
    await db.chatRoomParticipant.create({ data: { userId: b.id, chatRoomId: roomId } });
  });

  it("flood protection: more than 60 messages per minute are refused", async () => {
    const sa = await connect({ token: token(a) });
    await rpc(sa, "join_room", { roomId });
    const acks = await Promise.all(Array.from({ length: 70 }, (_, i) => rpc<{ ok: boolean; error?: { code: string } }>(sa, "send_message", { roomId: key(), content: `m${i}`, tempId: `f-${i}` })));
    const accepted = acks.filter((x) => x.ok).length;
    const limited = acks.filter((x) => !x.ok && /RATE|LIMIT|FLOOD/i.test(x.error?.code ?? ""));
    expect(accepted).toBeGreaterThan(0);                         // not vacuous: real messages DO pass
    expect(accepted).toBeLessThanOrEqual(60);
    expect(limited.length).toBeGreaterThan(0);                   // and the overflow is refused for the right reason
  });

  it("HTTP surface: /health public; /metrics and /internal/notify require the shared secret", async () => {
    expect((await fetch(`${URL_}/health`)).status).toBe(200);
    expect((await fetch(`${URL_}/metrics`)).status).toBe(401);
    expect((await fetch(`${URL_}/metrics`, { headers: { "x-internal-secret": INTERNAL } })).status).toBe(200);
    const body = JSON.stringify({ userId: a.id, notification: { id: "n1", title: "t", body: "b", link: null, isRead: false, createdAt: new Date().toISOString() } });
    expect((await fetch(`${URL_}/internal/notify`, { method: "POST", body, headers: { "content-type": "application/json" } })).status).toBe(401);
    expect((await fetch(`${URL_}/internal/notify`, { method: "POST", body, headers: { "content-type": "application/json", "x-internal-secret": "wrong".repeat(6) } })).status).toBe(401);
  });
});
