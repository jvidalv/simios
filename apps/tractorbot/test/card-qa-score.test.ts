import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  scoreVerdict,
  EXPECTED_FINISH,
} from "../src/dev/card-qa-score.js";
import { BORDER_COLOR, type Border, type Surface } from "../src/domain/rarity.js";
import {
  CardVerdictSchema,
  type CardVerdict,
} from "../src/gemini/card-vision.js";

/** Build a verdict, narrowing the colour string through the schema. */
function verdict(v: {
  is_card: boolean;
  border_color: string;
  surface_finish: CardVerdict["surface_finish"];
}): CardVerdict {
  return CardVerdictSchema.parse(v);
}

const BORDERS: Border[] = ["common", "magic", "rare", "legendary", "unique"];
const SURFACES: Surface[] = ["normal", "rugged", "shiny"];

describe("scoreVerdict", () => {
  it("passes when the vision verdict matches the rolled border + surface", () => {
    for (const border of BORDERS) {
      for (const surface of SURFACES) {
        const score = scoreVerdict(
          { border, surface },
          verdict({
            is_card: true,
            border_color: BORDER_COLOR[border],
            surface_finish: EXPECTED_FINISH[surface],
          }),
        );
        assert.ok(score.isCard);
        assert.ok(score.borderOk, `${border} border should match`);
        assert.ok(score.surfaceOk, `${surface} finish should match`);
      }
    }
  });

  it("fails border when the colour is wrong", () => {
    const score = scoreVerdict(
      { border: "common", surface: "normal" },
      verdict({ is_card: true, border_color: "blue", surface_finish: "matte" }),
    );
    assert.equal(score.borderOk, false);
    assert.ok(score.surfaceOk);
  });

  it("fails surface when the finish is wrong", () => {
    const score = scoreVerdict(
      { border: "unique", surface: "shiny" },
      verdict({ is_card: true, border_color: "purple", surface_finish: "matte" }),
    );
    assert.ok(score.borderOk);
    assert.equal(score.surfaceOk, false);
  });

  it("flags a non-card verdict", () => {
    const score = scoreVerdict(
      { border: "common", surface: "normal" },
      verdict({ is_card: false, border_color: "gray", surface_finish: "matte" }),
    );
    assert.equal(score.isCard, false);
  });

  it("maps every surface to a distinct expected finish", () => {
    const finishes = new Set(SURFACES.map((s) => EXPECTED_FINISH[s]));
    assert.equal(finishes.size, SURFACES.length);
  });
});
