import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  compileTriggers,
  extractUserHint,
  findTriggerMatch,
  matchesTrigger,
  triggerWordsForTheme,
} from "../src/domain/trigger.js";
import { type TriggerGroup } from "../src/domain/theme.js";

const TRIGGER_GROUPS: readonly TriggerGroup[] = [
  { theme: "tractor", words: ["claude", "claudio"] },
  { theme: "luddite", words: ["ludita", "luditas", "luddite", "luddites"] },
];
const TRIGGERS = compileTriggers(TRIGGER_GROUPS);

describe("matchesTrigger", () => {
  it("matches tractor words at the start or end of a message", () => {
    assert.equal(matchesTrigger("claude what's up", TRIGGERS), true);
    assert.equal(matchesTrigger("hey claudio", TRIGGERS), true);
  });

  it("matches luddite words in Spanish and English", () => {
    assert.equal(matchesTrigger("ludita total", TRIGGERS), true);
    assert.equal(matchesTrigger("sois unos luditas", TRIGGERS), true);
    assert.equal(matchesTrigger("classic luddite behavior", TRIGGERS), true);
    assert.equal(matchesTrigger("the luddites return", TRIGGERS), true);
  });

  it("matches case-insensitively", () => {
    assert.equal(matchesTrigger("CLAUDE!", TRIGGERS), true);
    assert.equal(matchesTrigger("LuDiTa!", TRIGGERS), true);
  });

  it("matches with punctuation around the word", () => {
    assert.equal(matchesTrigger("hey, claude, look!", TRIGGERS), true);
    assert.equal(matchesTrigger("hey, ludita, mira esto", TRIGGERS), true);
  });

  it("does not match substrings inside other words", () => {
    assert.equal(matchesTrigger("claudette is here", TRIGGERS), false);
    assert.equal(matchesTrigger("preclaudio", TRIGGERS), false);
    assert.equal(matchesTrigger("antiludita", TRIGGERS), false);
    assert.equal(matchesTrigger("luditamente", TRIGGERS), false);
  });

  it("returns false when text is empty or no trigger word is present", () => {
    assert.equal(matchesTrigger("", TRIGGERS), false);
    assert.equal(matchesTrigger("nothing to see here", TRIGGERS), false);
  });
});

describe("findTriggerMatch", () => {
  it("returns the tractor theme for tractor words", () => {
    assert.deepEqual(findTriggerMatch("claude un buen john deere", TRIGGERS), {
      theme: "tractor",
      word: "claude",
    });
  });

  it("returns the luddite theme for luddite words", () => {
    assert.deepEqual(findTriggerMatch("ludita contra los patinetes", TRIGGERS), {
      theme: "luddite",
      word: "ludita",
    });
  });

  it("uses the earliest trigger word when a message contains several themes", () => {
    assert.deepEqual(findTriggerMatch("ludita contra claude", TRIGGERS), {
      theme: "luddite",
      word: "ludita",
    });
  });

  it("matches the longer trigger when the shorter would not fit (luditas, not ludita)", () => {
    assert.deepEqual(findTriggerMatch("sois unos luditas hoy", TRIGGERS), {
      theme: "luddite",
      word: "luditas",
    });
    assert.deepEqual(findTriggerMatch("the luddites return", TRIGGERS), {
      theme: "luddite",
      word: "luddites",
    });
  });
});

describe("triggerWordsForTheme", () => {
  it("returns the configured words for a theme", () => {
    assert.deepEqual(triggerWordsForTheme(TRIGGER_GROUPS, "tractor"), [
      "claude",
      "claudio",
    ]);
  });
});

describe("extractUserHint", () => {
  it("keeps the whole message intact, trigger word included", () => {
    assert.equal(
      extractUserHint("I love claudio and im working on a robot with it"),
      "I love claudio and im working on a robot with it",
    );
    assert.equal(
      extractUserHint("ludita contra los patinetes electricos"),
      "ludita contra los patinetes electricos",
    );
  });

  it("collapses whitespace and trims", () => {
    assert.equal(
      extractUserHint("  claude   un buen   john deere  "),
      "claude un buen john deere",
    );
  });

  it("returns undefined for a whitespace-only message", () => {
    assert.equal(extractUserHint("   \n\t  "), undefined);
  });

  it("truncates very long messages with an ellipsis", () => {
    const result = extractUserHint("ludita " + "a".repeat(500));
    assert.ok(result !== undefined);
    assert.ok(result.length <= 201);
    assert.ok(result.endsWith("…"));
  });
});
