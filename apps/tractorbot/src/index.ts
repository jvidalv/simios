import {
  onlyChat,
  parseTelegramUser,
  startBotWith409Retry,
  startHealthServer,
} from "@simios/telegram-kit";
import { Bot, InputFile } from "grammy";
import { loadConfig } from "./config.js";
import { createGeminiImageClient } from "./gemini/image.js";
import { createGeminiTextClient } from "./gemini/text.js";
import { createCardNamer } from "./prompt/card-namer.js";
import {
  buildPromptParts,
  imageFilenameForPrompt,
  renderCaption,
  renderPrompt,
} from "./domain/prompt.js";
import {
  compileTriggers,
  findTriggerMatch,
  extractUserHint,
} from "./domain/trigger.js";
import { rollBorder, rollSurface } from "./domain/rarity.js";
import { rollCardType } from "./domain/card-type.js";
import { CARD_CAPTION_PARSE_MODE } from "./domain/markdown.js";
import { CardSchema, type Card } from "./domain/card.js";
import { createServices, ensureSheetsReady } from "./services.js";
import { buildCollection } from "./commands/collection.js";

/** Largest stored photo size carries the file_id we persist. */
function largestFileId(
  photos: readonly { file_id: string }[] | undefined,
): string | undefined {
  return photos?.[photos.length - 1]?.file_id;
}

async function main(): Promise<void> {
  console.log("tractorbot: validating environment…");
  const config = loadConfig();
  const triggerSummary = config.triggerGroups
    .map((group) => `${group.theme}:${group.words.join("/")}`)
    .join(", ");
  console.log(
    `tractorbot: environment OK (chat ${String(config.chatId)}, ` +
      `triggers ${triggerSummary}, cooldown ${String(config.cooldownSeconds)}s)`,
  );

  const services = createServices(config);
  await ensureSheetsReady(services);

  const gemini = createGeminiImageClient({
    apiKey: config.geminiApiKey,
    model: config.geminiModel,
  });
  const text = createGeminiTextClient({
    apiKey: config.geminiApiKey,
    model: config.geminiTextModel,
  });
  const namer = createCardNamer(text);

  const triggerPatterns = compileTriggers(config.triggerGroups);
  const bot = new Bot(config.botToken);
  bot.use(onlyChat(config.chatId));

  await bot.api.setMyCommands([
    {
      command: "collection",
      description: "Show a user's card collection: /collection [@user]",
    },
  ]);
  bot.command("collection", buildCollection(services));

  let lastFiredAt = 0;
  let inFlight = false;

  bot.on("message:text", async (ctx) => {
    const messageText = ctx.message.text;
    const match = findTriggerMatch(messageText, triggerPatterns);
    if (match === undefined) return;

    const now = Date.now();
    if (now - lastFiredAt < config.cooldownSeconds * 1000) return;
    if (inFlight) return;
    lastFiredAt = now;
    inFlight = true;

    try {
      const user = parseTelegramUser(ctx);
      if (user === undefined) return;

      // Roll rarity + card type first — they shape the name, concept, image.
      const border = config.forceBorder ?? rollBorder();
      const surface = config.forceSurface ?? rollSurface();
      const cardType = rollCardType();
      const parts = buildPromptParts(match.theme);
      const userHint = extractUserHint(messageText);

      // Full card data before the image, deduped against this user's cards.
      const existingNames = (await services.cards.listAll())
        .filter((c) => c.user_id === user.user_id)
        .map((c) => c.name);
      const data = await namer.name({
        theme: match.theme,
        cardType,
        border,
        surface,
        avoid: existingNames,
        ...(userHint !== undefined ? { userHint } : {}),
      });

      const prompt = renderPrompt({ parts, cardType, ...data, border, surface });
      console.log(
        `tractorbot: ${match.theme}/${match.word} → "${data.name}" (${cardType}/${border}/${surface})` +
          `${userHint === undefined ? "" : ` hint="${userHint}"`}`,
      );

      await ctx.replyWithChatAction("upload_photo");
      const image = await gemini.generate(prompt);
      const sent = await ctx.replyWithPhoto(
        new InputFile(image.bytes, imageFilenameForPrompt(parts)),
        {
          caption: renderCaption({
            name: data.name,
            card_type: cardType,
            border,
            surface,
          }),
          parse_mode: CARD_CAPTION_PARSE_MODE,
          reply_parameters: { message_id: ctx.message.message_id },
        },
      );

      // Persist the card. A sheet hiccup must never break the image reply —
      // the user already got their card; we just couldn't file it.
      const fileId = largestFileId(sent.photo);
      if (fileId === undefined) {
        console.error("tractorbot: sent photo had no file_id; not saving card");
        return;
      }
      const card: Card = CardSchema.parse({
        card_id: new Date(now).toISOString(),
        user_id: user.user_id,
        first_name: user.first_name,
        name: data.name,
        card_type: cardType,
        type_line: data.type_line,
        cost: data.cost,
        rules_text: data.rules_text,
        flavor_text: data.flavor_text,
        power: data.power,
        toughness: data.toughness,
        border,
        surface,
        theme: match.theme,
        file_id: fileId,
        generated_at: new Date(now).toISOString(),
        ...(user.username !== undefined ? { username: user.username } : {}),
      });
      await services.cards.append(card).catch((err: unknown) => {
        console.error("tractorbot: failed to save card:", err);
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("tractorbot: generation failed:", message);
    } finally {
      inFlight = false;
    }
  });

  bot.catch((err) => {
    console.error("Bot error:", err);
  });

  let healthy = false;
  startHealthServer({ isHealthy: () => healthy });

  console.log(
    `tractorbot starting — chat ${String(config.chatId)}, model ${config.geminiModel}`,
  );
  await startBotWith409Retry(bot, {
    label: "tractorbot",
    onStart: () => {
      healthy = true;
      console.log("tractorbot: long polling started");
    },
  });
}

main().catch((err: unknown) => {
  if (
    err !== null &&
    typeof err === "object" &&
    "error_code" in err &&
    err.error_code === 409
  ) {
    console.error(
      "Fatal: another tractorbot instance is already long-polling this token. " +
        "Stop the other one (local dev process, previous Railway deploy still draining, " +
        "or a second service using the same BOT_TOKEN) and this one will recover.",
    );
  } else {
    console.error("Fatal:", err);
  }
  process.exit(1);
});
