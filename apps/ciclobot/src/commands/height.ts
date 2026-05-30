import { parseTelegramUser } from "@simios/telegram-kit";
import { withOptional } from "@simios/sheets-client";
import type { BotContext } from "../context.js";
import type { Services } from "../services.js";
import { CmSchema } from "../domain/parse.js";
import {
  HeightCmSchema,
  isActive,
  type Participant,
} from "../domain/participant.js";

export function buildHeight(services: Services) {
  return async function handleHeight(ctx: BotContext): Promise<void> {
    const user = parseTelegramUser(ctx);
    if (user === undefined) {
      await ctx.reply("Cannot identify you.");
      return;
    }
    const participant = await services.participants.findByKey(user.user_id);
    if (participant === undefined || !isActive(participant)) {
      await ctx.reply("Use /join to enter the challenge first.");
      return;
    }

    const text = ctx.message?.text ?? "";
    const args = text.split(/\s+/).slice(1);
    const raw = args[0];
    if (raw === undefined) {
      await ctx.reply("Usage: /height <cm>\nExample: /height 178");
      return;
    }
    const num = CmSchema.safeParse(raw);
    if (!num.success) {
      await ctx.reply(`Couldn't read "${raw}" as a number. Example: 178`);
      return;
    }
    const validated = HeightCmSchema.safeParse(num.data);
    if (!validated.success) {
      if (num.data > 0 && num.data < 3) {
        await ctx.reply("Please use centimetres, not metres. Example: /height 178");
      } else {
        await ctx.reply("Out of range. Height must be between 100 and 250 cm.");
      }
      return;
    }

    // Spread keeps joined_at, left_at, and the stored username; withOptional
    // refreshes the username from Telegram only when present (and non-empty),
    // matching how /join and /weight handle the optional field.
    const base: Participant = {
      ...participant,
      height_cm: validated.data,
    };
    const updated: Participant = withOptional(base, "username", user.username);

    await services.participants.upsert(updated);
    await ctx.reply(`Updated height: ${String(validated.data)} cm.`);
  };
}
