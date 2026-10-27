import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { registerAction } from "@/actions/auth/register";
import { updateUserAction } from "@/actions/admin/update-user";
import { resetDatabase, createUser } from "./helpers/factories";
import { actAs, resetSession } from "./helpers/session";

beforeAll(resetDatabase);
beforeEach(resetSession);

describe("F1 — JWT callback never trusts client-supplied data", () => {
  it("ignores role/name sent through session.update()", async () => {
    const u = await createUser("STUDENT", { name: "Real Name" });
    const jwt = authOptions.callbacks!.jwt!;
    const token = await jwt({
      token: { id: u.id, role: "STUDENT", name: "Real Name" } as never,
      trigger: "update",
      session: { role: "ADMIN", name: "Hacker" },
    } as never);
    expect(token.role).toBe("STUDENT");
    expect(token.name).toBe("Real Name");
  });

  it("re-reads the role from the DB on update (after a server-side upgrade)", async () => {
    const u = await createUser("STUDENT");
    await db.user.update({ where: { id: u.id }, data: { role: "CREATOR" } });
    const token = await authOptions.callbacks!.jwt!({
      token: { id: u.id, role: "STUDENT" } as never,
      trigger: "update",
    } as never);
    expect(token.role).toBe("CREATOR");
  });
});

describe("F9 — registration can never self-assign a privileged role", () => {
  it("creates a STUDENT even if the client sends role=CREATOR/ADMIN", async () => {
    for (const role of ["CREATOR", "ADMIN"]) {
      const email = `evil-${role.toLowerCase()}@test.local`;
      const res = await registerAction({
        name: "Evil User", email, password: "Str0ng!Pass", confirmPassword: "Str0ng!Pass",
        role,
      } as never);
      expect(res.success).toBe(true);
      const row = await db.user.findUnique({ where: { email } });
      expect(row?.role).toBe("STUDENT");
    }
  });

  it("rejects a duplicate email cleanly", async () => {
    const input = { name: "Dup User", email: "dup@test.local", password: "Str0ng!Pass", confirmPassword: "Str0ng!Pass" };
    expect((await registerAction(input)).success).toBe(true);
    const second = await registerAction(input);
    expect(second.success).toBe(false);
  });

  it("rate-limits sign-ups per IP (3/hour)", async () => {
    const results = [];
    for (let i = 0; i < 5; i++) {
      results.push(
        await registerAction({
          name: "Rate User", email: `rate${i}@test.local`,
          password: "Str0ng!Pass", confirmPassword: "Str0ng!Pass",
        })
      );
    }
    expect(results.filter((r) => r.success).length).toBe(3);
    expect(results.slice(3).every((r) => !r.success)).toBe(true);
  });
});

describe("F4 — privileged actions use the DB role, not the stale JWT role", () => {
  it("CONTROL: an active admin can change a user's role", async () => {
    const admin = await createUser("ADMIN");
    const victim = await createUser("STUDENT");
    actAs({ id: admin.id, role: "ADMIN" });
    const res = await updateUserAction({ userId: victim.id, action: "CHANGE_ROLE", role: "CREATOR" });
    expect(res.success).toBe(true);
    expect((await db.user.findUnique({ where: { id: victim.id } }))?.role).toBe("CREATOR");
  });

  it("a demoted admin whose JWT still says ADMIN is refused", async () => {
    const admin = await createUser("ADMIN");
    const victim = await createUser("STUDENT");
    actAs({ id: admin.id, role: "ADMIN" });                                        // stale JWT
    await db.user.update({ where: { id: admin.id }, data: { role: "STUDENT" } });  // demoted in DB
    const res = await updateUserAction({ userId: victim.id, action: "CHANGE_ROLE", role: "CREATOR" });
    expect(res).toMatchObject({ success: false, error: "FORBIDDEN" });
    expect((await db.user.findUnique({ where: { id: victim.id } }))?.role).toBe("STUDENT");
  });

  it("a suspended admin whose JWT is still valid is refused", async () => {
    const admin = await createUser("ADMIN");
    const victim = await createUser("STUDENT");
    actAs({ id: admin.id, role: "ADMIN" });
    await db.user.update({ where: { id: admin.id }, data: { isActive: false } });
    const res = await updateUserAction({ userId: victim.id, action: "TOGGLE_ACTIVE" });
    expect(res).toMatchObject({ success: false, error: "FORBIDDEN" });
    expect((await db.user.findUnique({ where: { id: victim.id } }))?.isActive).toBe(true);
  });
});
