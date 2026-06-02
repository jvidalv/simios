import type { Context } from "grammy";
import type { InputMediaPhoto } from "grammy/types";
import type { Services } from "../services.js";
import type { Card } from "../domain/card.js";
import { BorderSchema } from "../domain/rarity.js";
import { renderCaption } from "../domain/prompt.js";
import { parseCollectionArgs } from "../domain/collection-args.js";

// Telegram caps a media group at 10 items.
export const ALBUM_MAX = 10;

// Rank = position in the border enum (common=0 … unique=4), so a higher rank
// is rarer. selectUserCards sorts by descending rank → rarest first.
const BORDER_RANK = new Map(BorderSchema.options.map((b, i) => [b, i]));

function rankOf(card: Card): number {
  return BORDER_RANK.get(card.border) ?? 0;
}

/**
 * Pick out one user's cards (case-insensitive on the stored username) and sort
 * them rarest-first. Pure — the network/IO lives in the handler.
 */
export function selectUserCards(
  all: readonly Card[],
  username: string,
): Card[] {
  const wanted = username.toLowerCase();
  return all
    .filter(
      (card) =>
        card.username !== undefined && card.username.toLowerCase() === wanted,
    )
    .sort((a, b) => rankOf(b) - rankOf(a));
}

/** Split an array into chunks of at most `size`. */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

export function buildCollection(services: Services) {
  return async function handleCollection(ctx: Context): Promise<void> {
    const parsed = parseCollectionArgs(ctx.message?.text ?? "");
    if (!parsed.ok) {
      await ctx.reply(parsed.error);
      return;
    }

    // Telegram can't resolve a @handle to an id, so we match the requested
    // username against the username stored on each card row.
    const label = `@${parsed.username}`;

    let cards: Card[];
    try {
      cards = selectUserCards(
        await services.cards.listAll(),
        parsed.username,
      );
    } catch (err) {
      console.error("tractorbot: /collection lookup failed:", err);
      await ctx.reply("Couldn't reach the card vault. Try again in a moment.");
      return;
    }

    if (cards.length === 0) {
      await ctx.reply(`${label} has no cards yet. Summon some monkeys first.`);
      return;
    }

    const triggerId = ctx.message?.message_id;

    const header =
      `${label} — ${String(cards.length)} ` +
      `${cards.length === 1 ? "card" : "cards"}`;
    await ctx
      .reply(header, triggerId === undefined ? {} : { reply_parameters: { message_id: triggerId } })
      .catch((err: unknown) => {
        console.error("tractorbot: /collection header failed:", err);
      });

    // Re-send each card by its stored Telegram file_id as media-group albums.
    for (const group of chunk(cards, ALBUM_MAX)) {
      const media: InputMediaPhoto[] = group.map((card) => ({
        type: "photo",
        media: card.file_id,
        caption: renderCaption(card),
      }));
      try {
        await ctx.replyWithMediaGroup(media);
      } catch (err) {
        console.error("tractorbot: /collection album send failed:", err);
      }
    }
  };
}
