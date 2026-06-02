/**
 * `/collection` takes exactly one argument: a member's @username. The leading
 * `@` is optional ("/collection @vidal" and "/collection vidal" both work).
 * Bare `/collection` with no argument is rejected with a usage hint — there is
 * no self default.
 */
export type ParsedCollectionArgs =
  | { readonly ok: true; readonly username: string }
  | { readonly ok: false; readonly error: string };

const USAGE = "Usage: /collection <@username>. Example: /collection @vidal";

// Telegram usernames are 5–32 chars of [A-Za-z0-9_]. We accept a looser 1–32
// so a typo gets a clean "no cards" reply downstream rather than a usage error.
const USERNAME_RE = /^[A-Za-z0-9_]{1,32}$/;

export function parseCollectionArgs(text: string): ParsedCollectionArgs {
  const match = /^\/collection(?:@\S+)?(\s+(.+))?$/.exec(text.trim());
  if (match === null) {
    return { ok: false, error: USAGE };
  }
  const afterCommand = (match[2] ?? "").trim();
  if (afterCommand.length === 0) {
    return { ok: false, error: USAGE };
  }
  const handle = afterCommand.startsWith("@")
    ? afterCommand.slice(1)
    : afterCommand;
  if (!USERNAME_RE.test(handle)) {
    return { ok: false, error: USAGE };
  }
  return { ok: true, username: handle };
}
