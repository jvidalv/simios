import { stripControlChars } from "./sanitise.js";

/**
 * Telegram MarkdownV2 parse mode. We use it for the card caption so the field
 * values can be **bold**. The price is a large escape surface — MarkdownV2
 * treats `_*[]()~`>#+-=|{}.!` as control chars, and any unescaped one is a 400
 * that drops the whole message. Card names are model-authored and full of
 * those, so every interpolated value MUST go through `escapeMarkdownV2`.
 */
export const CARD_CAPTION_PARSE_MODE = "MarkdownV2";

/** Escape every MarkdownV2 metacharacter in interpolated text. */
export function escapeMarkdownV2(text: string): string {
  return stripControlChars(text).replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, "\\$&");
}

/** Wrap already-escaped text in a MarkdownV2 bold span. */
export function bold(escaped: string): string {
  return `*${escaped}*`;
}
