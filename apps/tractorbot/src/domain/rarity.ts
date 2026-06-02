import { z } from "zod";

/**
 * A card has two INDEPENDENT rarity rolls:
 *  - `border`: five tiers, each mapped to a colour. This is the axis that
 *    escalates the monkey's stature and the scene's grandeur.
 *  - `surface`: three finishes (matte / weathered / foil). Pure cosmetics —
 *    a `shiny` finish can land on a `common` card just as a `normal` finish
 *    can land on a `unique` one.
 *
 * Both are weighted toward the common end: the rarer the tier, the rarer the
 * roll. Weights are plain relative integers (not percentages) — `rollWeighted`
 * normalises by their sum.
 */
export const BorderSchema = z.enum([
  "common",
  "magic",
  "rare",
  "legendary",
  "unique",
]);
export type Border = z.infer<typeof BorderSchema>;

export const SurfaceSchema = z.enum(["normal", "rugged", "shiny"]);
export type Surface = z.infer<typeof SurfaceSchema>;

// Relative weights. Border: common is overwhelmingly likely, unique is a
// once-in-a-while prize. Roughly common 55% / magic 25% / rare 12% /
// legendary 6% / unique 2%.
const BORDER_WEIGHTS: Readonly<Record<Border, number>> = {
  common: 55,
  magic: 25,
  rare: 12,
  legendary: 6,
  unique: 2,
};

// Surface: most cards are a plain matte; foil is the rare treat. Roughly
// normal 70% / rugged 24% / shiny 6%.
const SURFACE_WEIGHTS: Readonly<Record<Surface, number>> = {
  normal: 70,
  rugged: 24,
  shiny: 6,
};

/**
 * Pick a key from a weight table using `rng` (defaults to Math.random, but is
 * injectable so tests are deterministic). Walks the cumulative weight; the
 * final entry is the guaranteed fallback for the `rng() === ~1` edge.
 */
export function rollWeighted<K extends string>(
  keys: readonly K[],
  weights: Readonly<Record<K, number>>,
  rng: () => number,
): K {
  const total = keys.reduce((sum, k) => sum + weights[k], 0);
  let threshold = rng() * total;
  for (const key of keys) {
    threshold -= weights[key];
    if (threshold < 0) return key;
  }
  const last = keys[keys.length - 1];
  if (last === undefined) {
    throw new Error("rollWeighted: empty weight table");
  }
  return last;
}

export function rollBorder(rng: () => number = Math.random): Border {
  return rollWeighted(BorderSchema.options, BORDER_WEIGHTS, rng);
}

export function rollSurface(rng: () => number = Math.random): Surface {
  return rollWeighted(SurfaceSchema.options, SURFACE_WEIGHTS, rng);
}

/** The card-edge colour drawn for each border tier. */
export const BORDER_COLOR: Readonly<Record<Border, string>> = {
  common: "gray",
  magic: "blue",
  rare: "yellow",
  legendary: "orange",
  unique: "purple",
};

/**
 * Caption emoji per border tier — a coloured square matching each tier's
 * border colour (gray→white square, blue, yellow, orange, purple), so the
 * rarity reads at a glance and every tier is visibly distinct.
 */
export const BORDER_EMOJI: Readonly<Record<Border, string>> = {
  common: "⬜",
  magic: "🟦",
  rare: "🟨",
  legendary: "🟧",
  unique: "🟪",
};

export const BORDER_LABEL: Readonly<Record<Border, string>> = {
  common: "common",
  magic: "magic",
  rare: "rare",
  legendary: "legendary",
  unique: "unique",
};

export const SURFACE_LABEL: Readonly<Record<Surface, string>> = {
  normal: "normal",
  rugged: "rugged",
  shiny: "shiny",
};

/** Caption emoji per surface finish: flat matte, weathered stone, foil shine. */
export const SURFACE_EMOJI: Readonly<Record<Surface, string>> = {
  normal: "📄",
  rugged: "🪨",
  shiny: "🌈",
};

/**
 * The rarity-escalation axis: the monkey SUBJECT itself grows in stature as
 * the border tier rises — from an ordinary monkey to a mythic figure. The
 * image prompt renders the monkey as this archetype.
 */
export const MONKEY_ARCHETYPE: Readonly<Record<Border, string>> = {
  common: "an ordinary monkey",
  magic: "a magic-touched monkey adept wreathed in faint arcane light",
  rare: "a renowned monkey champion in battle-worn finery",
  legendary:
    "a legendary monkey commander crowned and armoured, with regalia and a retinue",
  unique:
    "a singular mythic monkey of legend, radiating otherworldly power, the only one of its kind",
};

/**
 * How grand the surrounding scene should feel for each tier — humble and
 * plain at the bottom, vast and ornate at the top. Pairs with the archetype.
 */
export const SCENE_GRANDEUR: Readonly<Record<Border, string>> = {
  common: "a humble, plain setting, modest and grounded",
  magic: "a softly enchanted setting with subtle magical detail",
  rare: "a striking, detailed setting befitting a champion",
  legendary:
    "an epic, ornate, sweeping setting with dramatic scale and rich detail",
  unique:
    "a mythic, awe-inspiring vista of impossible grandeur, every detail steeped in legend",
};

/**
 * Finish description fed to the image prompt for each surface roll. These are
 * deliberately emphatic and unmistakable — a subtle "weathered" reads as plain
 * matte to a vision grader, so rugged and shiny state their texture loudly.
 */
export const SURFACE_FINISH: Readonly<Record<Surface, string>> = {
  normal: "a clean, flat matte finish with no shine and no texture",
  rugged:
    "a heavily WEATHERED, battle-worn finish — visibly aged and distressed, with cracked, scuffed, embossed texture, frayed and torn edges, stains and scratches all over the card, like an ancient relic card",
  shiny:
    "a dazzling HOLOGRAPHIC FOIL finish — the whole card shimmers with rainbow prismatic reflections and bright specular highlights, an unmistakable glossy mirror-like foil sheen",
};
