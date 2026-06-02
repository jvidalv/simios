import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  createCardNamer,
  type CardNamerArgs,
} from "../src/prompt/card-namer.js";
import type { GeminiTextClient } from "../src/gemini/text.js";
import { CARD_NAME_MAX_CHARS } from "../src/domain/card.js";

function stubClient(
  reply: (args: { user: string }) => unknown,
): GeminiTextClient {
  return {
    generateJson: ({ user }) => Promise.resolve(reply({ user })),
  };
}

function throwingClient(): GeminiTextClient {
  return {
    generateJson: () => Promise.reject(new Error("boom")),
  };
}

/** A complete model reply; override fields per test. */
function fullReply(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: "Soulrender del Yermo",
    type_line: "Criatura Legendaria — Mono Brujo",
    cost: "2 BV",
    rules_text: "Vínculo 2. Al inicio, alguien suspira.",
    flavor_text: "No reza. Solo aprieta.",
    power: "3",
    toughness: "4",
    concept: "an epic monkey commander raising a rusted blade",
    ...over,
  };
}

const BASE: CardNamerArgs = {
  theme: "tractor",
  cardType: "monkey",
  border: "legendary",
  surface: "shiny",
  avoid: [],
};

describe("createCardNamer", () => {
  it("returns the model's sanitised full card data", async () => {
    const namer = createCardNamer(
      stubClient(() => fullReply({ name: "  Soulrender  del Yermo " })),
    );
    const out = await namer.name(BASE);
    assert.equal(out.name, "Soulrender del Yermo");
    assert.equal(out.type_line, "Criatura Legendaria — Mono Brujo");
    assert.equal(out.power, "3");
    assert.equal(out.toughness, "4");
    assert.ok(out.rules_text.length > 0);
    assert.ok(out.concept.length > 0);
  });

  it("clears power/toughness for a non-creature type", async () => {
    // The model returns P/T but the card is a weapon → forced empty.
    const namer = createCardNamer(
      stubClient(() => fullReply({ power: "9", toughness: "9" })),
    );
    const out = await namer.name({ ...BASE, cardType: "weapon" });
    assert.equal(out.power, "");
    assert.equal(out.toughness, "");
  });

  it("fallback gives a non-creature type no power/toughness", async () => {
    const namer = createCardNamer(throwingClient());
    const out = await namer.name({ ...BASE, cardType: "land" });
    assert.equal(out.power, "");
    assert.equal(out.toughness, "");
    assert.equal(out.cost, ""); // lands have no cost in the fallback
    assert.ok(out.type_line.length > 0);
  });

  it("retries past a duplicate name then accepts a fresh one", async () => {
    let call = 0;
    const namer = createCardNamer(
      stubClient(() => {
        call += 1;
        return call === 1
          ? fullReply({ name: "Ashmaw" })
          : fullReply({ name: "Brasero del Humo" });
      }),
    );
    const out = await namer.name({ ...BASE, avoid: ["ashmaw"] });
    assert.equal(out.name, "Brasero del Humo");
    assert.ok(call >= 2);
  });

  it("falls back when a required field is missing", async () => {
    // rules_text empty → reply rejected → local fallback fills all fields.
    const namer = createCardNamer(
      stubClient(() => fullReply({ rules_text: "" })),
      0,
    );
    const out = await namer.name(BASE);
    assert.ok(out.rules_text.length > 0);
    assert.ok(out.type_line.length > 0);
  });

  it("falls back locally when the client always throws", async () => {
    const namer = createCardNamer(throwingClient());
    const out = await namer.name(BASE);
    assert.ok(out.name.length > 0);
    assert.ok(out.name.length <= CARD_NAME_MAX_CHARS);
    assert.ok(out.concept.length > 0);
    assert.ok(out.type_line.length > 0);
    assert.ok(out.rules_text.length > 0);
    assert.ok(out.power.length > 0);
  });

  it("fallback name avoids existing collection names", async () => {
    const namer = createCardNamer(throwingClient());
    // Pre-seed with a large avoid set; the fallback must still produce a
    // name not in it.
    const avoid = ["Cursed Brasero del Yermo"];
    const out = await namer.name({ ...BASE, avoid });
    assert.ok(!avoid.map((n) => n.toLowerCase()).includes(out.name.toLowerCase()));
  });

  it("folds the user hint into the prompt", async () => {
    let seenUser = "";
    const namer = createCardNamer(
      stubClient(({ user }) => {
        seenUser = user;
        return fullReply({
          name: "Dragón de Madrid",
          concept: "a monkey riding a dragon over Madrid",
        });
      }),
    );
    await namer.name({ ...BASE, userHint: "un dragón en Madrid" });
    assert.match(seenUser, /Madrid/);
  });
});
