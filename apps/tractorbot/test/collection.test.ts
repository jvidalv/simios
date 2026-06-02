import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  selectUserCards,
  chunk,
  ALBUM_MAX,
} from "../src/commands/collection.js";
import { CardSchema, type Card } from "../src/domain/card.js";
import type { Border } from "../src/domain/rarity.js";

let seq = 0;
function makeCard(over: Partial<Card> = {}): Card {
  seq += 1;
  return CardSchema.parse({
    card_id: `id-${String(seq)}`,
    user_id: 1,
    username: "vidal",
    first_name: "Vidal",
    name: `Card ${String(seq)}`,
    card_type: "monkey",
    type_line: "Criatura — Mono",
    cost: "1",
    rules_text: "Hace algo.",
    flavor_text: "",
    power: "1",
    toughness: "1",
    border: "common",
    surface: "normal",
    theme: "tractor",
    file_id: `file-${String(seq)}`,
    generated_at: "2026-06-01T00:00:00.000Z",
    ...over,
  });
}

describe("selectUserCards", () => {
  it("matches the stored username case-insensitively", () => {
    const cards = [
      makeCard({ username: "Vidal" }),
      makeCard({ username: "someone" }),
      makeCard({ username: "VIDAL" }),
    ];
    const out = selectUserCards(cards, "vidal");
    assert.equal(out.length, 2);
  });

  it("returns empty when no card matches", () => {
    const cards = [makeCard({ username: "alice" })];
    assert.equal(selectUserCards(cards, "bob").length, 0);
  });

  it("skips cards with no stored username", () => {
    const cards = [makeCard({ username: undefined }), makeCard({ username: "vidal" })];
    assert.equal(selectUserCards(cards, "vidal").length, 1);
  });

  it("sorts rarest first (unique → common)", () => {
    const order: Border[] = ["common", "unique", "rare", "magic", "legendary"];
    const cards = order.map((border) => makeCard({ border, username: "vidal" }));
    const out = selectUserCards(cards, "vidal").map((c) => c.border);
    assert.deepEqual(out, ["unique", "legendary", "rare", "magic", "common"]);
  });
});

describe("chunk", () => {
  it("splits into album-sized groups", () => {
    const items = Array.from({ length: 23 }, (_, i) => i);
    const groups = chunk(items, ALBUM_MAX);
    assert.deepEqual(
      groups.map((g) => g.length),
      [10, 10, 3],
    );
  });

  it("returns no groups for an empty list", () => {
    assert.deepEqual(chunk([], ALBUM_MAX), []);
  });

  it("keeps a single short group intact", () => {
    assert.deepEqual(chunk([1, 2, 3], ALBUM_MAX), [[1, 2, 3]]);
  });
});
