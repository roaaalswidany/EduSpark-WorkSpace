/**
 * VirusTotal URL scanner — isolated module, zero side effects.
 *
 * Strategy:
 *  1. GET cached report (saves quota — public API is 4 req/min, 500/day)
 *  2. If not cached → POST submit → poll analysis (max ~8s)
 *  3. On timeout → "unknown" (lenient)
 *  4. On any error → "error" (caller decides: fail-open or fail-closed)
 *
 * Callers decide policy. Recommended (per project spec):
 *  - "malicious" → BLOCK (fail-closed)
 *  - "error" / "disabled" / "unknown" → ALLOW with warning log (fail-open)
 */

const VT_BASE = "https://www.virustotal.com/api/v3";
const REQUEST_TIMEOUT_MS = 8_000;
const MAX_POLL_ATTEMPTS = 4;
const POLL_INTERVAL_MS = 2_000;

export type UrlScanStatus =
  | "clean"
  | "suspicious"
  | "malicious"
  | "unknown"
  | "error"
  | "disabled";

export interface UrlScanResult {
  url: string;
  status: UrlScanStatus;
  malicious: number;
  suspicious: number;
  harmless: number;
  undetected: number;
  errorMessage?: string;
}

interface VtStats {
  malicious?: number;
  suspicious?: number;
  harmless?: number;
  undetected?: number;
}

function encodeUrlId(url: string): string {
  // VirusTotal uses unpadded base64url of the URL
  return Buffer.from(url)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function classify(stats: VtStats): UrlScanStatus {
  const malicious = stats.malicious ?? 0;
  const suspicious = stats.suspicious ?? 0;
  if (malicious > 0) return "malicious";
  if (suspicious > 0) return "suspicious";
  return "clean";
}

async function vtGet(
  path: string,
  apiKey: string,
  signal: AbortSignal
): Promise<unknown | null> {
  const res = await fetch(`${VT_BASE}${path}`, {
    headers: { "x-apikey": apiKey, accept: "application/json" },
    signal,
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`VirusTotal ${res.status} ${res.statusText}`);
  }
  return res.json();
}

async function vtPost(
  path: string,
  body: URLSearchParams,
  apiKey: string,
  signal: AbortSignal
): Promise<unknown> {
  const res = await fetch(`${VT_BASE}${path}`, {
    method: "POST",
    headers: {
      "x-apikey": apiKey,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    signal,
  });
  if (!res.ok) {
    throw new Error(`VirusTotal ${res.status} ${res.statusText}`);
  }
  return res.json();
}

function emptyResult(url: string, status: UrlScanStatus, errorMessage?: string): UrlScanResult {
  return { url, status, malicious: 0, suspicious: 0, harmless: 0, undetected: 0, errorMessage };
}

export async function scanUrl(url: string): Promise<UrlScanResult> {
  const apiKey = process.env.VIRUSTOTAL_API_KEY?.trim();
  if (!apiKey) {
    return emptyResult(url, "disabled", "VIRUSTOTAL_API_KEY not configured");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    // 1. Cached report first
    const urlId = encodeUrlId(url);
    const existing = (await vtGet(`/urls/${urlId}`, apiKey, controller.signal)) as {
      data?: { attributes?: { last_analysis_stats?: VtStats } };
    } | null;

    const cached = existing?.data?.attributes?.last_analysis_stats;
    if (cached) {
      return {
        url,
        status: classify(cached),
        malicious: cached.malicious ?? 0,
        suspicious: cached.suspicious ?? 0,
        harmless: cached.harmless ?? 0,
        undetected: cached.undetected ?? 0,
      };
    }

    // 2. Submit for fresh analysis
    const submitted = (await vtPost(
      "/urls",
      new URLSearchParams({ url }),
      apiKey,
      controller.signal
    )) as { data?: { id?: string } };

    const analysisId = submitted?.data?.id;
    if (!analysisId) {
      return emptyResult(url, "error", "VirusTotal returned no analysis ID");
    }

    // 3. Poll for completion (bounded)
    for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

      const analysis = (await vtGet(
        `/analyses/${analysisId}`,
        apiKey,
        controller.signal
      )) as {
        data?: { attributes?: { status?: string; stats?: VtStats } };
      } | null;

      const attrs = analysis?.data?.attributes;
      if (attrs?.status === "completed" && attrs.stats) {
        return {
          url,
          status: classify(attrs.stats),
          malicious: attrs.stats.malicious ?? 0,
          suspicious: attrs.stats.suspicious ?? 0,
          harmless: attrs.stats.harmless ?? 0,
          undetected: attrs.stats.undetected ?? 0,
        };
      }
    }

    // Timeout — be lenient (caller will fail-open)
    return emptyResult(url, "unknown", "VirusTotal analysis timed out");
  } catch (err) {
    return emptyResult(
      url,
      "error",
      err instanceof Error ? err.message : "VirusTotal request failed"
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function scanUrls(urls: string[]): Promise<UrlScanResult[]> {
  return Promise.all(urls.map(scanUrl));
}