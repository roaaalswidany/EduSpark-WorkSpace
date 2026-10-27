export interface Mail { to: string; subject: string; text: string; html: string }
const store = () => ((globalThis as { __mails?: Mail[] }).__mails ??= []);
export const outbox = () => store();
export const clearOutbox = () => { store().length = 0; };
/** Extracts the raw 64-hex token from the link in the last mail to `to`. */
export function lastToken(to: string): string {
  const m = [...store()].reverse().find((x) => x.to === to);
  const t = m?.text.match(/token=([a-f0-9]{64})/)?.[1];
  if (!t) throw new Error(`no token mail for ${to}`);
  return t;
}
