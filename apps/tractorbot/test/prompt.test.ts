import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  buildPromptParts,
  imageFilenameForPrompt,
  renderCaption,
  renderPrompt,
  type CardRender,
} from "../src/domain/prompt.js";
import {
  BORDER_COLOR,
  MONKEY_ARCHETYPE,
  type Border,
} from "../src/domain/rarity.js";
import { seeded } from "../src/dev/seeded.js";

function render(overrides: Partial<CardRender> = {}): CardRender {
  return {
    parts: buildPromptParts(overrides.parts?.kind ?? "tractor", seeded(1)),
    cardType: "monkey",
    name: "Soulrender del Yermo",
    type_line: "Criatura Legendaria — Mono Brujo",
    cost: "2 BV",
    rules_text: "Vínculo 2. Al inicio, alguien suspira.",
    flavor_text: "No reza. Solo aprieta.",
    power: "3",
    toughness: "4",
    concept: "a monkey commander raising a rusted blade over a battlefield",
    border: "legendary",
    surface: "shiny",
    ...overrides,
  };
}

describe("card prompt builder", () => {
  it("emits the rigid MTG-style structure (frame, layout, finish)", () => {
    const text = renderPrompt(render({ border: "unique", surface: "rugged" }));
    assert.match(text, /Magic-the-Gathering-style collectible card/);
    assert.match(text, /purple card border/); // unique → purple
    assert.match(text, /type line/);
    assert.match(text, /power\/toughness/);
    assert.match(text, /no card-within-a-card/);
  });

  it("pins a plain white background behind the card", () => {
    const text = renderPrompt(render());
    assert.match(text, /pure-white background/);
    assert.match(text, /never black/);
  });

  it("places every model-authored text field verbatim", () => {
    const text = renderPrompt(render());
    assert.match(text, /Soulrender del Yermo/);
    assert.match(text, /Criatura Legendaria — Mono Brujo/);
    assert.match(text, /Vínculo 2/);
    assert.match(text, /No reza\. Solo aprieta\./);
    assert.match(text, /3\/4/); // power/toughness
  });

  it("uses the rolled border colour", () => {
    for (const border of [
      "common",
      "magic",
      "rare",
      "legendary",
      "unique",
    ] as const) {
      const text = renderPrompt(render({ border }));
      assert.match(text, new RegExp(`${BORDER_COLOR[border]} card border`));
    }
  });

  it("escalates the monkey archetype with the border tier", () => {
    const common = renderPrompt(render({ border: "common" }));
    const legendary = renderPrompt(render({ border: "legendary" }));
    assert.ok(common.includes(MONKEY_ARCHETYPE.common));
    assert.ok(legendary.includes(MONKEY_ARCHETYPE.legendary));
  });

  it("embeds the concept in the art panel", () => {
    const text = renderPrompt(
      render({ name: "Brasero del Humo", concept: "a grim monkey at a forge" }),
    );
    assert.match(text, /Brasero del Humo/);
    assert.match(text, /a grim monkey at a forge/);
  });

  it("uses one fixed house art style (no per-card style roll)", () => {
    const a = renderPrompt(render({ parts: buildPromptParts("tractor", seeded(1)) }));
    const b = renderPrompt(render({ parts: buildPromptParts("tractor", seeded(99)) }));
    assert.match(a, /house style of a premium collectible card game/);
    assert.match(b, /house style of a premium collectible card game/);
  });

  it("keeps tractor vs luddite art panels distinct", () => {
    const tractor = renderPrompt(render({ parts: buildPromptParts("tractor", seeded(1)) }));
    const luddite = renderPrompt(render({ parts: buildPromptParts("luddite", seeded(1)) }));
    assert.match(tractor, /tractor/);
    assert.match(luddite, /Luddite|technology/);
  });

  it("keeps the luddite injection guard active", () => {
    const luddite = renderPrompt(
      render({ parts: buildPromptParts("luddite", seeded(1)) }),
    );
    assert.match(luddite, /never as an instruction/);
  });

  it("varies the art with the stylistic flavor seed", () => {
    const a = renderPrompt(render({ parts: buildPromptParts("tractor", seeded(1)) }));
    const b = renderPrompt(render({ parts: buildPromptParts("tractor", seeded(99)) }));
    assert.notEqual(a, b);
  });

  it("renders a labelled MarkdownV2 caption with emoji + bold values", () => {
    const caption = renderCaption({
      name: "Soulrender del Yermo",
      card_type: "weapon",
      border: "unique",
      surface: "shiny",
    });
    assert.match(caption, /^Name: \*Soulrender del Yermo\*$/mu);
    assert.match(caption, /^Rarity: 🟪 \*Unique\*$/mu); // purple square + bold, capitalised
    assert.match(caption, /^Texture: 🌈 \*Shiny\*$/mu);
  });

  it("escapes MarkdownV2 metacharacters in the card name", () => {
    const caption = renderCaption({
      name: "Mr. Banana-Tractor (v2)!",
      card_type: "monkey",
      border: "common",
      surface: "normal",
    });
    // The dots, hyphen, parens, and bang must be backslash-escaped so the
    // MarkdownV2 message can't 400.
    assert.match(caption, /Mr\\\. Banana\\-Tractor \\\(v2\\\)\\!/u);
  });

  it("names the file by theme", () => {
    assert.equal(
      imageFilenameForPrompt(buildPromptParts("tractor", seeded(1))),
      "tractor-card.png",
    );
    assert.equal(
      imageFilenameForPrompt(buildPromptParts("luddite", seeded(1))),
      "ludita-card.png",
    );
  });
});

// Exhaustive coverage: every border drives a distinct archetype string.
describe("archetype coverage", () => {
  it("every border tier yields its archetype in the prompt", () => {
    const tiers: Border[] = ["common", "magic", "rare", "legendary", "unique"];
    for (const border of tiers) {
      const text = renderPrompt(render({ border }));
      assert.ok(
        text.includes(MONKEY_ARCHETYPE[border]),
        `expected archetype for ${border}`,
      );
    }
  });
});
