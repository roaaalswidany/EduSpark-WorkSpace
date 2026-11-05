/**
 * Unit tests for lib/virustotal.ts
 * Mocks global.fetch — no real API calls, no rate limits, runs in <1s.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { scanUrl, scanUrls } from "@/lib/virustotal";

const originalFetch = global.fetch;

beforeEach(() => {
  process.env.VIRUSTOTAL_API_KEY = "test-api-key-not-real";
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
  delete process.env.VIRUSTOTAL_API_KEY;
});

// Helper: build a fake cached-report response
function cachedResponse(stats: {
  malicious?: number;
  suspicious?: number;
  harmless?: number;
  undetected?: number;
}) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      data: { attributes: { last_analysis_stats: stats } },
    }),
  };
}

describe("scanUrl — API key handling", () => {
  it("returns 'disabled' when VIRUSTOTAL_API_KEY is missing", async () => {
    delete process.env.VIRUSTOTAL_API_KEY;
    const result = await scanUrl("https://example.com");
    expect(result.status).toBe("disabled");
    expect(result.url).toBe("https://example.com");
    expect(result.errorMessage).toContain("VIRUSTOTAL_API_KEY");
  });

  it("returns 'disabled' when VIRUSTOTAL_API_KEY is empty", async () => {
    process.env.VIRUSTOTAL_API_KEY = "   ";
    const result = await scanUrl("https://example.com");
    expect(result.status).toBe("disabled");
  });
});

describe("scanUrl — cached reports", () => {
  it("classifies a clean cached report", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(
      cachedResponse({ malicious: 0, suspicious: 0, harmless: 70, undetected: 5 })
    ) as any;

    const result = await scanUrl("https://example.com");
    expect(result.status).toBe("clean");
    expect(result.malicious).toBe(0);
    expect(result.suspicious).toBe(0);
    expect(result.harmless).toBe(70);
    expect(result.undetected).toBe(5);
  });

  it("classifies a malicious cached report", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(
      cachedResponse({ malicious: 5, suspicious: 0, harmless: 60, undetected: 10 })
    ) as any;

    const result = await scanUrl("https://evil.example");
    expect(result.status).toBe("malicious");
    expect(result.malicious).toBe(5);
  });

  it("classifies a suspicious cached report", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(
      cachedResponse({ malicious: 0, suspicious: 3, harmless: 60, undetected: 12 })
    ) as any;

    const result = await scanUrl("https://maybe.example");
    expect(result.status).toBe("suspicious");
    expect(result.suspicious).toBe(3);
  });

  it("prefers 'malicious' over 'suspicious' when both are positive", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(
      cachedResponse({ malicious: 2, suspicious: 4, harmless: 50, undetected: 20 })
    ) as any;

    const result = await scanUrl("https://double.example");
    expect(result.status).toBe("malicious");
  });
});

describe("scanUrl — error handling", () => {
  it("returns 'error' on network failure", async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error("ECONNREFUSED")) as any;
    const result = await scanUrl("https://example.com");
    expect(result.status).toBe("error");
    expect(result.errorMessage).toContain("ECONNREFUSED");
  });

  it("returns 'error' on HTTP 500 from VirusTotal", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    }) as any;

    const result = await scanUrl("https://example.com");
    expect(result.status).toBe("error");
    expect(result.errorMessage).toContain("500");
  });

  it("returns 'error' on HTTP 429 (rate limited)", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
    }) as any;

    const result = await scanUrl("https://example.com");
    expect(result.status).toBe("error");
    expect(result.errorMessage).toContain("429");
  });
});

describe("scanUrls — batch helper", () => {
  it("returns an empty array for empty input", async () => {
    const results = await scanUrls([]);
    expect(results).toEqual([]);
  });

  it("returns one result per URL (order preserved)", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(cachedResponse({ malicious: 0, suspicious: 0, harmless: 70 }))
      .mockResolvedValueOnce(cachedResponse({ malicious: 3, suspicious: 0, harmless: 60 })) as any;

    const results = await scanUrls(["https://safe.com", "https://bad.com"]);
    expect(results).toHaveLength(2);
    expect(results[0].status).toBe("clean");
    expect(results[0].url).toBe("https://safe.com");
    expect(results[1].status).toBe("malicious");
    expect(results[1].url).toBe("https://bad.com");
  });
});
