import { JsonObject, NonEmptyString, parseEnv } from "@simios/env";
import { ServiceAccountCredentialsSchema } from "@simios/sheets-client";
import { z } from "zod";
import { BorderSchema, SurfaceSchema } from "./domain/rarity.js";

const TriggerWords = z
  .string()
  .min(1)
  .transform((raw) =>
    raw
      .split(",")
      .map((w) => w.trim().toLowerCase())
      .filter((w) => w.length > 0),
  )
  .pipe(z.array(z.string().min(1)).min(1));

// Dev-only tier pins. A blank/absent env var (the default) means "roll
// normally"; a set value must be a valid tier. index.ts uses the pin instead
// of the weighted roll so each border/surface combo can be eyeballed locally
// without edits. The "" sentinel is unwound to `undefined` in the transform
// below. Kept as a plain string→union pipe (not z.preprocess) to avoid
// widening the RawEnvSchema input to `unknown`.
function optionalTier<T extends z.ZodTypeAny>(schema: T) {
  return z
    .string()
    .default("")
    .transform((s) => s.trim().toLowerCase())
    .pipe(z.union([z.literal(""), schema]));
}

const RawEnvSchema = z.object({
  BOT_TOKEN: NonEmptyString,
  GEMINI_API_KEY: NonEmptyString,
  CHAT_ID: z.coerce.number().int(),
  SHEET_ID: NonEmptyString,
  GOOGLE_SERVICE_ACCOUNT_JSON: JsonObject.pipe(ServiceAccountCredentialsSchema),
  TRACTOR_TRIGGER_WORDS: TriggerWords.default("claude,claudio"),
  LUDDITE_TRIGGER_WORDS: TriggerWords.default(
    "ludita,luditas,luddite,luddites",
  ),
  COOLDOWN_SECONDS: z.coerce.number().int().min(0).default(60),
  GEMINI_MODEL: NonEmptyString.default("gemini-2.5-flash-image"),
  GEMINI_TEXT_MODEL: NonEmptyString.default("gemini-2.5-flash"),
  FORCE_BORDER: optionalTier(BorderSchema),
  FORCE_SURFACE: optionalTier(SurfaceSchema),
});

const ConfigSchema = RawEnvSchema.transform((raw) => ({
  botToken: raw.BOT_TOKEN,
  geminiApiKey: raw.GEMINI_API_KEY,
  chatId: raw.CHAT_ID,
  sheetId: raw.SHEET_ID,
  serviceAccount: raw.GOOGLE_SERVICE_ACCOUNT_JSON,
  triggerGroups: [
    { theme: "tractor" as const, words: raw.TRACTOR_TRIGGER_WORDS },
    { theme: "luddite" as const, words: raw.LUDDITE_TRIGGER_WORDS },
  ],
  cooldownSeconds: raw.COOLDOWN_SECONDS,
  geminiModel: raw.GEMINI_MODEL,
  geminiTextModel: raw.GEMINI_TEXT_MODEL,
  forceBorder: raw.FORCE_BORDER === "" ? undefined : raw.FORCE_BORDER,
  forceSurface: raw.FORCE_SURFACE === "" ? undefined : raw.FORCE_SURFACE,
}));
export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(): Config {
  return parseEnv(ConfigSchema);
}
