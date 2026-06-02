/**
 * Text-sanitisation primitives for any user- or model-influenced text that
 * flows into a Gemini prompt or a sheet cell (card names, the triggering
 * message hint, the @handle in /collection).
 *
 * Strip control chars first, then collapse whitespace, then cap length.
 */

// Strip ASCII control chars (\x00-\x1F, \x7F) and Unicode bidi/format
// controls — zero-width spaces (U+200B–U+200F), bidi overrides
// (U+202A–U+202E), isolate marks (U+2066–U+2069), BOM (U+FEFF).
const CONTROL_CHAR_RE = new RegExp(
  "[\\u0000-\\u001F\\u007F\\u200B-\\u200F\\u202A-\\u202E\\u2066-\\u2069\\uFEFF]",
  "g",
);

/** Replace control characters with a space; does not collapse whitespace. */
export function stripControlChars(text: string): string {
  return text.replace(CONTROL_CHAR_RE, " ");
}

/**
 * Full hygiene pass for free text headed into a prompt or a sheet cell:
 * strip control chars, collapse whitespace runs, trim, then truncate to
 * `maxChars`. Never rejects — returns "" for empty input so callers can
 * decide what an empty value means.
 */
export function sanitiseText(text: string, maxChars: number): string {
  const collapsed = stripControlChars(text).replace(/\s+/g, " ").trim();
  return collapsed.length > maxChars
    ? collapsed.slice(0, maxChars).trimEnd()
    : collapsed;
}
