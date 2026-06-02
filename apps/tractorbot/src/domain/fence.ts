/**
 * Delimiters used to fence each piece of user- or model-influenced text fed
 * to Gemini (the triggering message, the avoid-list of existing card names).
 * The system prompt treats anything between <msg> and </msg> as literal
 * content — never as structure or instructions. `fenceBody` escapes any
 * literal fence tokens inside the wrapped text so the fence stays stable.
 */
export const MESSAGE_FENCE_OPEN = "<msg>";
export const MESSAGE_FENCE_CLOSE = "</msg>";

// Zero-width-space–broken copies of the fence tokens. A literal `<msg>` in the
// wrapped text is rewritten to these so it can never close a real fence;
// visually identical, structurally inert.
const BROKEN_OPEN = "<​msg>";
const BROKEN_CLOSE = "</​msg>";

export function fenceBody(text: string): string {
  const safe = text
    .replaceAll(MESSAGE_FENCE_OPEN, BROKEN_OPEN)
    .replaceAll(MESSAGE_FENCE_CLOSE, BROKEN_CLOSE);
  return `${MESSAGE_FENCE_OPEN}${safe}${MESSAGE_FENCE_CLOSE}`;
}
