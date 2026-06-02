import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  BORDER_COLOR,
  BORDER_EMOJI,
  MONKEY_ARCHETYPE,
  SCENE_GRANDEUR,
  SURFACE_FINISH,
  rollBorder,
  rollSurface,
  type Border,
  type Surface,
} from "../src/domain/rarity.js";
import { seeded } from "../src/dev/seeded.js";

/** A constant generator — useful for hitting a known slot in the weight walk. */
function constant(value: number): () => number {
  return () => value;
}

describe("rarity rolls", () => {
  it("rng() = 0 yields the first (most common) tier", () => {
    assert.equal(rollBorder(constant(0)), "common");
    assert.equal(rollSurface(constant(0)), "normal");
  });

  it("rng() near 1 yields the rarest tier", () => {
    assert.equal(rollBorder(constant(0.999999)), "unique");
    assert.equal(rollSurface(constant(0.999999)), "shiny");
  });

  it("every border tier is reachable", () => {
    const seen = new Set<Border>();
    const rng = seeded(7);
    for (let i = 0; i < 5000; i++) seen.add(rollBorder(rng));
    for (const tier of [
      "common",
      "magic",
      "rare",
      "legendary",
      "unique",
    ] as const) {
      assert.ok(seen.has(tier), `expected to roll ${tier}`);
    }
  });

  it("every surface tier is reachable", () => {
    const seen = new Set<Surface>();
    const rng = seeded(13);
    for (let i = 0; i < 5000; i++) seen.add(rollSurface(rng));
    for (const tier of ["normal", "rugged", "shiny"] as const) {
      assert.ok(seen.has(tier), `expected to roll ${tier}`);
    }
  });

  it("common is by far the most frequent border over many rolls", () => {
    const counts: Record<Border, number> = {
      common: 0,
      magic: 0,
      rare: 0,
      legendary: 0,
      unique: 0,
    };
    const rng = seeded(42);
    const N = 20000;
    for (let i = 0; i < N; i++) counts[rollBorder(rng)] += 1;
    assert.ok(counts.common > counts.magic);
    assert.ok(counts.magic > counts.rare);
    assert.ok(counts.rare > counts.legendary);
    assert.ok(counts.legendary > counts.unique);
    // common should dominate — well over a third even with sampling noise.
    assert.ok(counts.common / N > 0.4);
  });
});

describe("rarity maps", () => {
  it("covers every border tier in every border-keyed map", () => {
    for (const tier of [
      "common",
      "magic",
      "rare",
      "legendary",
      "unique",
    ] as const) {
      assert.ok(BORDER_COLOR[tier].length > 0);
      assert.ok(BORDER_EMOJI[tier].length > 0);
      assert.ok(MONKEY_ARCHETYPE[tier].length > 0);
      assert.ok(SCENE_GRANDEUR[tier].length > 0);
    }
  });

  it("covers every surface tier in the finish map", () => {
    for (const tier of ["normal", "rugged", "shiny"] as const) {
      assert.ok(SURFACE_FINISH[tier].length > 0);
    }
  });

  it("maps each border to its documented colour", () => {
    assert.equal(BORDER_COLOR.common, "gray");
    assert.equal(BORDER_COLOR.magic, "blue");
    assert.equal(BORDER_COLOR.rare, "yellow");
    assert.equal(BORDER_COLOR.legendary, "orange");
    assert.equal(BORDER_COLOR.unique, "purple");
  });
});
