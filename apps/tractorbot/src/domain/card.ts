import { z } from "zod";
import { BorderSchema, SurfaceSchema } from "./rarity.js";
import { CardTypeSchema } from "./card-type.js";
import { ImageThemeSchema } from "./theme.js";
import { sanitiseText } from "./sanitise.js";

/** Hard caps for the model-authored card text fields. */
export const CARD_NAME_MAX_CHARS = 80;
export const CARD_TYPE_LINE_MAX_CHARS = 60;
export const CARD_COST_MAX_CHARS = 24;
export const CARD_RULES_MAX_CHARS = 240;
export const CARD_FLAVOR_MAX_CHARS = 160;
export const CARD_STAT_MAX_CHARS = 4;
export const CARD_CONCEPT_MAX_CHARS = 240;

/**
 * The model-authored card payload — a dark-fantasy, dark-humour, Spanish
 * Magic-style card whose hero is a monkey, plus a `concept` sentence for the
 * art. This is the single source of truth for that shape: the namer's reply,
 * the image-prompt input, and (minus `concept`) the persisted card all derive
 * from it. Each field carries the same cap used everywhere downstream.
 */
export const CardConceptSchema = z.object({
  name: z.string().min(1).max(CARD_NAME_MAX_CHARS),
  type_line: z.string().min(1).max(CARD_TYPE_LINE_MAX_CHARS),
  cost: z.string().max(CARD_COST_MAX_CHARS),
  rules_text: z.string().min(1).max(CARD_RULES_MAX_CHARS),
  flavor_text: z.string().max(CARD_FLAVOR_MAX_CHARS),
  power: z.string().max(CARD_STAT_MAX_CHARS),
  toughness: z.string().max(CARD_STAT_MAX_CHARS),
  concept: z.string().min(1).max(CARD_CONCEPT_MAX_CHARS),
});
export type CardConcept = z.infer<typeof CardConceptSchema>;

/**
 * One collectible card as stored: the model payload (minus the art-only
 * `concept`) plus identity, rarity, and the Telegram image reference. Many
 * cards share a `user_id`, so the unique key is `card_id` (a per-generation
 * ISO timestamp).
 */
export const CardSchema = CardConceptSchema.omit({ concept: true }).extend({
  card_id: z.string().min(1),
  user_id: z.number().int(),
  username: z.string().optional(),
  first_name: z.string().min(1),
  card_type: CardTypeSchema,
  border: BorderSchema,
  surface: SurfaceSchema,
  theme: ImageThemeSchema,
  file_id: z.string().min(1),
  generated_at: z.string().min(1),
});
export type Card = z.infer<typeof CardSchema>;

/** Per-field caps for the model payload — drives sanitisation. */
const FIELD_CAPS: Readonly<Record<keyof CardConcept, number>> = {
  name: CARD_NAME_MAX_CHARS,
  type_line: CARD_TYPE_LINE_MAX_CHARS,
  cost: CARD_COST_MAX_CHARS,
  rules_text: CARD_RULES_MAX_CHARS,
  flavor_text: CARD_FLAVOR_MAX_CHARS,
  power: CARD_STAT_MAX_CHARS,
  toughness: CARD_STAT_MAX_CHARS,
  concept: CARD_CONCEPT_MAX_CHARS,
};

/** Clean one model payload field (control-strip + collapse + cap). */
export function sanitiseField(field: keyof CardConcept, raw: string): string {
  return sanitiseText(raw, FIELD_CAPS[field]);
}
