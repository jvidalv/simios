import { z } from "zod";
import { rollWeighted } from "./rarity.js";

/**
 * The kind of card. A monkey is the default creature; the others are
 * progressively RARER than a monkey, by design — so most cards still feature
 * the mascot and the non-creature types feel like a treat.
 *
 * Weights are relative integers (not percentages), normalised by their sum:
 *   monkey ~70%, weapon ~14%, artifact ~10%, land ~6%.
 * This roll is INDEPENDENT of the border/surface rarity rolls.
 */
export const CardTypeSchema = z.enum(["monkey", "weapon", "artifact", "land"]);
export type CardType = z.infer<typeof CardTypeSchema>;

const CARD_TYPE_WEIGHTS: Readonly<Record<CardType, number>> = {
  monkey: 70,
  weapon: 14,
  artifact: 10,
  land: 6,
};

export function rollCardType(rng: () => number = Math.random): CardType {
  return rollWeighted(CardTypeSchema.options, CARD_TYPE_WEIGHTS, rng);
}

/**
 * Per-type rules in ONE place, keyed by CardType with no index signature — so
 * adding a card type is a compile error until every facet is filled in. The
 * Spanish SYSTEM_PROMPT prose (in card-namer) is authored separately because
 * it instructs the model; these are the pure-data facets the namer, fallback,
 * and image prompt all read so they can't drift.
 */
export interface CardTypeProfile {
  /** Carries a power/toughness box (creatures only). */
  readonly hasPowerToughness: boolean;
  /** Has a mana cost (lands don't). */
  readonly hasCost: boolean;
  /** Spanish type-line stem for the offline fallback; `legendary` upgrades it. */
  readonly fallbackTypeLine: (legendary: boolean, monkeyType: string) => string;
  /** Spanish rules line for the offline fallback. */
  readonly fallbackRules: string;
}

export const CARD_TYPE_PROFILE: Readonly<Record<CardType, CardTypeProfile>> = {
  monkey: {
    hasPowerToughness: true,
    hasCost: true,
    fallbackTypeLine: (legendary, monkeyType) =>
      `${legendary ? "Criatura Legendaria" : "Criatura"} — ${monkeyType}`,
    fallbackRules: "Cuando este mono entra en juego, alguien suspira.",
  },
  weapon: {
    hasPowerToughness: false,
    hasCost: true,
    fallbackTypeLine: () => "Artefacto — Equipo",
    fallbackRules: "Equipar 2. La criatura equipada obtiene +1/+1.",
  },
  artifact: {
    hasPowerToughness: false,
    hasCost: true,
    fallbackTypeLine: (legendary) =>
      legendary ? "Artefacto Legendario" : "Artefacto",
    fallbackRules: "Cuando este artefacto entra en juego, alguien suspira.",
  },
  land: {
    hasPowerToughness: false,
    hasCost: false,
    fallbackTypeLine: (legendary) => (legendary ? "Tierra Legendaria" : "Tierra"),
    fallbackRules: "Toca para añadir un maná de cualquier color.",
  },
};

/** Does this card type carry a power/toughness box? Only creatures (monkeys). */
export function hasPowerToughness(type: CardType): boolean {
  return CARD_TYPE_PROFILE[type].hasPowerToughness;
}

/** Caption emoji for each card type. */
export const CARD_TYPE_EMOJI: Readonly<Record<CardType, string>> = {
  monkey: "🐒",
  weapon: "⚔️",
  artifact: "🏺",
  land: "🗺️",
};

/** Spanish label for each card type (used in prompts/captions). */
export const CARD_TYPE_LABEL: Readonly<Record<CardType, string>> = {
  monkey: "mono",
  weapon: "arma",
  artifact: "artefacto",
  land: "tierra",
};
