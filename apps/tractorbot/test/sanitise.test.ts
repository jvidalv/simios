import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { sanitiseText, stripControlChars } from "../src/domain/sanitise.js";
import { sanitiseField, CARD_NAME_MAX_CHARS } from "../src/domain/card.js";

describe("sanitiseText", () => {
  it("strips a zero-width space into a regular space", () => {
    // U+200B between "ren" and "der" becomes a space, then collapses to one.
    const dirty = "Soul ren​der";
    assert.equal(sanitiseText(dirty, 80), "Soul ren der");
  });

  it("collapses whitespace runs and trims", () => {
    assert.equal(
      sanitiseText("  Frost   fang \n the  Gray ", 80),
      "Frost fang the Gray",
    );
  });

  it("truncates to the cap without trailing space", () => {
    const out = sanitiseText("a".repeat(200), 10);
    assert.equal(out.length, 10);
  });

  it("returns empty string for whitespace-only input", () => {
    assert.equal(sanitiseText("   \n\t  ", 80), "");
  });

  it("neutralises a bidi override", () => {
    const out = stripControlChars("ab‮cd");
    assert.ok(!out.includes("‮"));
  });
});

describe("sanitiseField", () => {
  it("caps a field at its limit", () => {
    const out = sanitiseField("name", "x".repeat(CARD_NAME_MAX_CHARS + 50));
    assert.ok(out.length <= CARD_NAME_MAX_CHARS);
  });
});
