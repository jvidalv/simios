import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  rollCardType,
  hasPowerToughness,
  CardTypeSchema,
  CARD_TYPE_EMOJI,
  CARD_TYPE_LABEL,
  type CardType,
} from "../src/domain/card-type.js";
import { seeded } from "../src/dev/seeded.js";

describe("rollCardType", () => {
  it("rng() = 0 yields monkey (the most common type)", () => {
    assert.equal(rollCardType(() => 0), "monkey");
  });

  it("rng() near 1 yields the rarest type (land)", () => {
    assert.equal(rollCardType(() => 0.999999), "land");
  });

  it("every card type is reachable", () => {
    const seen = new Set<CardType>();
    const rng = seeded(5);
    for (let i = 0; i < 5000; i++) seen.add(rollCardType(rng));
    for (const t of CardTypeSchema.options) {
      assert.ok(seen.has(t), `expected to roll ${t}`);
    }
  });

  it("monkey dominates and the others are progressively rarer", () => {
    const counts: Record<CardType, number> = {
      monkey: 0,
      weapon: 0,
      artifact: 0,
      land: 0,
    };
    const rng = seeded(11);
    const N = 20000;
    for (let i = 0; i < N; i++) counts[rollCardType(rng)] += 1;
    assert.ok(counts.monkey > counts.weapon);
    assert.ok(counts.weapon > counts.artifact);
    assert.ok(counts.artifact > counts.land);
    assert.ok(counts.monkey / N > 0.5, "monkey should be the clear majority");
  });
});

describe("hasPowerToughness", () => {
  it("only monkeys (creatures) carry power/toughness", () => {
    assert.equal(hasPowerToughness("monkey"), true);
    assert.equal(hasPowerToughness("weapon"), false);
    assert.equal(hasPowerToughness("artifact"), false);
    assert.equal(hasPowerToughness("land"), false);
  });
});

describe("card-type maps", () => {
  it("covers every type with a distinct emoji and a label", () => {
    const emojis = new Set<string>();
    for (const t of CardTypeSchema.options) {
      assert.ok(CARD_TYPE_EMOJI[t].length > 0);
      assert.ok(CARD_TYPE_LABEL[t].length > 0);
      emojis.add(CARD_TYPE_EMOJI[t]);
    }
    assert.equal(emojis.size, CardTypeSchema.options.length);
  });
});
