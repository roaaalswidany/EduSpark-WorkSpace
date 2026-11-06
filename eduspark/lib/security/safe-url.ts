// eduspark/lib/security/safe-url.ts
//
// One definition of "a link we are willing to store and render".
// Only https:// — never javascript:, data:, file: or plain http:.
// Used on the server (validation) and in the UI (defence in depth for rows stored before the rule existed).

export function isHttpsUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}
