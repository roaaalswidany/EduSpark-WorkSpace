import { getServerSession } from "next-auth";
import { vi, type Mock } from "vitest";

export type TestSessionUser = {
  id: string;
  role: "STUDENT" | "CREATOR" | "ADMIN";
  name?: string;
  email?: string;
};

/** Make getServerSession() return this user for the next calls. */
export function actAs(user: TestSessionUser | null) {
  (getServerSession as unknown as Mock).mockResolvedValue(
    user
      ? {
          user: {
            id: user.id,
            role: user.role,
            name: user.name ?? "Test User",
            email: user.email ?? `${user.id}@test.local`,
          },
        }
      : null
  );
}

export function resetSession() {
  (getServerSession as unknown as Mock).mockReset();
  vi.clearAllMocks();
}
