import { BORDER_COLOR, type Border, type Surface } from "../domain/rarity.js";
import type { CardVerdict } from "../gemini/card-vision.js";

/** Expected vision finish for each surface roll. */
export const EXPECTED_FINISH: Readonly<
  Record<Surface, CardVerdict["surface_finish"]>
> = {
  normal: "matte",
  rugged: "weathered",
  shiny: "foil",
};

export interface CardScore {
  readonly isCard: boolean;
  readonly borderOk: boolean;
  readonly surfaceOk: boolean;
}

/**
 * Pure scoring: does a vision verdict match what we rolled? Border colour must
 * match the tier's colour; finish must match the surface's expected finish.
 * Deterministic and API-free so it can be unit-tested.
 */
export function scoreVerdict(
  expected: { border: Border; surface: Surface },
  verdict: CardVerdict,
): CardScore {
  return {
    isCard: verdict.is_card,
    borderOk: verdict.border_color === BORDER_COLOR[expected.border],
    surfaceOk: verdict.surface_finish === EXPECTED_FINISH[expected.surface],
  };
}
