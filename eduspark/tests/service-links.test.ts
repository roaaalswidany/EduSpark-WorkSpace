import { describe, it, expect } from "vitest";
import { CreateServiceSchema } from "@/actions/marketplace/create-service-schema";

const links = CreateServiceSchema.shape.portfolioLinks;

describe("portfolioLinks schema", () => {
  it("accepts https links", () => {
    expect(links.safeParse(["https://example.com/work"]).success).toBe(true);
  });
  it("rejects javascript:, data:, file: and plain http", () => {
    for (const bad of ["javascript:alert(1)", "data:text/html,<b>x</b>", "file:///etc/passwd", "http://example.com"]) {
      expect(links.safeParse([bad]).success).toBe(false);
    }
  });
});