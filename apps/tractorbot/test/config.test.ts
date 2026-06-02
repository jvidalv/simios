import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { loadConfig } from "../src/config.js";

const VALID_SA = JSON.stringify({
  client_email: "x@y.iam.gserviceaccount.com",
  private_key: "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n",
});

const ENV_KEYS = [
  "BOT_TOKEN",
  "GEMINI_API_KEY",
  "CHAT_ID",
  "SHEET_ID",
  "GOOGLE_SERVICE_ACCOUNT_JSON",
  "TRACTOR_TRIGGER_WORDS",
  "LUDDITE_TRIGGER_WORDS",
  "COOLDOWN_SECONDS",
  "GEMINI_MODEL",
  "GEMINI_TEXT_MODEL",
  "FORCE_BORDER",
  "FORCE_SURFACE",
] as const;

/** The minimum required env for a successful parse. */
const BASE_ENV: NodeJS.ProcessEnv = {
  BOT_TOKEN: "abc:def",
  GEMINI_API_KEY: "key-123",
  CHAT_ID: "-1001234567890",
  SHEET_ID: "spreadsheet_id_here",
  GOOGLE_SERVICE_ACCOUNT_JSON: VALID_SA,
};

function withEnv<T>(vars: NodeJS.ProcessEnv, fn: () => T): T {
  const original = { ...process.env };
  for (const k of ENV_KEYS) delete process.env[k];
  Object.assign(process.env, vars);
  try {
    return fn();
  } finally {
    for (const k of Object.keys(process.env)) delete process.env[k];
    Object.assign(process.env, original);
  }
}

describe("loadConfig", () => {
  it("parses a valid env into a typed Config", () => {
    const config = withEnv(BASE_ENV, () => loadConfig());
    assert.equal(config.botToken, "abc:def");
    assert.equal(config.geminiApiKey, "key-123");
    assert.equal(config.chatId, -1001234567890);
    assert.equal(config.sheetId, "spreadsheet_id_here");
    assert.equal(
      config.serviceAccount.client_email,
      "x@y.iam.gserviceaccount.com",
    );
    assert.deepEqual(config.triggerGroups, [
      { theme: "tractor", words: ["claude", "claudio"] },
      { theme: "luddite", words: ["ludita", "luditas", "luddite", "luddites"] },
    ]);
    assert.equal(config.cooldownSeconds, 60);
    assert.equal(config.geminiModel, "gemini-2.5-flash-image");
    assert.equal(config.geminiTextModel, "gemini-2.5-flash");
    assert.equal(config.forceBorder, undefined);
    assert.equal(config.forceSurface, undefined);
  });

  it("rejects missing BOT_TOKEN", () => {
    const { BOT_TOKEN: _omit, ...rest } = BASE_ENV;
    withEnv(rest, () => {
      assert.throws(() => loadConfig(), /BOT_TOKEN/);
    });
  });

  it("rejects missing GEMINI_API_KEY", () => {
    const { GEMINI_API_KEY: _omit, ...rest } = BASE_ENV;
    withEnv(rest, () => {
      assert.throws(() => loadConfig(), /GEMINI_API_KEY/);
    });
  });

  it("rejects missing SHEET_ID", () => {
    const { SHEET_ID: _omit, ...rest } = BASE_ENV;
    withEnv(rest, () => {
      assert.throws(() => loadConfig(), /SHEET_ID/);
    });
  });

  it("rejects malformed GOOGLE_SERVICE_ACCOUNT_JSON", () => {
    withEnv({ ...BASE_ENV, GOOGLE_SERVICE_ACCOUNT_JSON: "not json" }, () => {
      assert.throws(() => loadConfig(), /GOOGLE_SERVICE_ACCOUNT_JSON/);
    });
  });

  it("parses dev-only FORCE_BORDER / FORCE_SURFACE pins", () => {
    const config = withEnv(
      { ...BASE_ENV, FORCE_BORDER: "Unique", FORCE_SURFACE: "shiny" },
      () => loadConfig(),
    );
    assert.equal(config.forceBorder, "unique");
    assert.equal(config.forceSurface, "shiny");
  });

  it("rejects an invalid FORCE_BORDER value", () => {
    withEnv({ ...BASE_ENV, FORCE_BORDER: "mythic" }, () => {
      assert.throws(() => loadConfig(), /FORCE_BORDER/);
    });
  });

  it("parses custom tractor trigger words", () => {
    const config = withEnv(
      { ...BASE_ENV, TRACTOR_TRIGGER_WORDS: "Foo, Bar ,BAZ" },
      () => loadConfig(),
    );
    assert.deepEqual(config.triggerGroups[0], {
      theme: "tractor",
      words: ["foo", "bar", "baz"],
    });
  });

  it("parses custom luddite trigger words", () => {
    const config = withEnv(
      { ...BASE_ENV, LUDDITE_TRIGGER_WORDS: "Ludita, Analogico" },
      () => loadConfig(),
    );
    assert.deepEqual(config.triggerGroups[1], {
      theme: "luddite",
      words: ["ludita", "analogico"],
    });
  });

  it("rejects empty trigger word lists", () => {
    withEnv({ ...BASE_ENV, TRACTOR_TRIGGER_WORDS: " , , " }, () => {
      assert.throws(() => loadConfig(), /TRACTOR_TRIGGER_WORDS/);
    });
    withEnv({ ...BASE_ENV, LUDDITE_TRIGGER_WORDS: " , , " }, () => {
      assert.throws(() => loadConfig(), /LUDDITE_TRIGGER_WORDS/);
    });
  });
});
