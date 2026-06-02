/**
 * Dev-only image-QA harness (NOT shipped to the bot runtime, NOT a unit test).
 *
 * Generates a batch of real card images across every border/surface tier,
 * sends each to a Gemini vision grader, and reports how often the rendered
 * card actually shows (a) a single framed card, (b) the expected border
 * colour, and (c) the expected surface finish. Target: >=95% per dimension.
 *
 * Run with creds in the environment:
 *   GEMINI_API_KEY=… pnpm -F tractorbot qa:cards [count]
 *
 * It deliberately does NOT touch Telegram or the sheet — it only exercises the
 * prompt → image → vision loop so the card structure can be tuned offline.
 */
import { createGeminiImageClient } from "../gemini/image.js";
import { createCardVisionClient } from "../gemini/card-vision.js";
import { buildPromptParts, renderPrompt } from "../domain/prompt.js";
import {
  BorderSchema,
  SurfaceSchema,
  type Border,
  type Surface,
} from "../domain/rarity.js";
import { scoreVerdict } from "./card-qa-score.js";
import { seeded } from "./seeded.js";
import type { ImageTheme } from "../domain/theme.js";

const IMAGE_MODEL = process.env["GEMINI_MODEL"] ?? "gemini-2.5-flash-image";
const VISION_MODEL = process.env["GEMINI_QA_MODEL"] ?? "gemini-2.5-flash";

interface Case {
  readonly theme: ImageTheme;
  readonly border: Border;
  readonly surface: Surface;
  readonly seed: number;
}

/** Build a reproducible matrix: every (border × surface × theme), `reps` each. */
function buildCases(reps: number): Case[] {
  const cases: Case[] = [];
  let seed = 1;
  for (const theme of ["tractor", "luddite"] as const) {
    for (const border of BorderSchema.options) {
      for (const surface of SurfaceSchema.options) {
        for (let r = 0; r < reps; r++) {
          cases.push({ theme, border, surface, seed: seed++ });
        }
      }
    }
  }
  return cases;
}

async function main(): Promise<void> {
  const apiKey = process.env["GEMINI_API_KEY"];
  if (apiKey === undefined || apiKey.length === 0) {
    throw new Error("GEMINI_API_KEY is required to run the card-QA harness");
  }
  const repsArg = Number(process.argv[2] ?? "1");
  const reps = Number.isFinite(repsArg) && repsArg > 0 ? Math.floor(repsArg) : 1;

  const image = createGeminiImageClient({ apiKey, model: IMAGE_MODEL });
  const vision = createCardVisionClient({ apiKey, model: VISION_MODEL });
  const cases = buildCases(reps);

  let graded = 0;
  let isCard = 0;
  let borderOk = 0;
  let surfaceOk = 0;
  const failures: string[] = [];

  let index = 0;
  for (const c of cases) {
    index++;
    const parts = buildPromptParts(c.theme, seeded(c.seed));
    // The QA grader only checks border/surface/is-card, so the card text is
    // static placeholder data — we're scoring the frame, not the writing.
    const prompt = renderPrompt({
      parts,
      cardType: "monkey",
      name: `QA ${c.border} ${c.surface}`,
      type_line: "Criatura — Mono",
      cost: "2",
      rules_text: "Carta de prueba.",
      flavor_text: "",
      power: "2",
      toughness: "2",
      concept: "a monkey emblem at the heart of the card",
      border: c.border,
      surface: c.surface,
    });
    const tag = `${c.theme}/${c.border}/${c.surface}`;
    process.stdout.write(
      `[${String(index)}/${String(cases.length)}] ${tag} … `,
    );
    try {
      const img = await image.generate(prompt);
      const verdict = await vision.verify({
        mimeType: img.mimeType,
        base64: img.bytes.toString("base64"),
      });
      graded++;
      console.log(
        `card=${String(verdict.is_card)} border=${verdict.border_color} finish=${verdict.surface_finish}`,
      );
      const score = scoreVerdict(c, verdict);
      if (score.isCard) isCard++;
      else failures.push(`${c.theme}/${c.border}/${c.surface}: not a card`);
      if (score.borderOk) borderOk++;
      else
        failures.push(
          `${c.theme}/${c.border}/${c.surface}: border ${verdict.border_color}`,
        );
      if (score.surfaceOk) surfaceOk++;
      else
        failures.push(
          `${c.theme}/${c.border}/${c.surface}: finish ${verdict.surface_finish}`,
        );
    } catch (err) {
      console.log(`ERROR`);
      failures.push(`${c.theme}/${c.border}/${c.surface}: ERROR ${String(err)}`);
    }
  }

  const pct = (n: number): string =>
    graded === 0 ? "0%" : `${((n / graded) * 100).toFixed(1)}%`;
  console.log(`\n=== card QA (${String(graded)}/${String(cases.length)} graded) ===`);
  console.log(`is a framed card : ${pct(isCard)}`);
  console.log(`border colour ok : ${pct(borderOk)}`);
  console.log(`surface finish ok: ${pct(surfaceOk)}`);
  if (failures.length > 0) {
    console.log(`\nmisses (${String(failures.length)}):`);
    for (const f of failures) console.log(`  - ${f}`);
  }
  const target = 0.95;
  const pass =
    graded > 0 &&
    isCard / graded >= target &&
    borderOk / graded >= target &&
    surfaceOk / graded >= target;
  console.log(`\n${pass ? "PASS" : "BELOW TARGET"} (target ${String(target * 100)}%)`);
  process.exitCode = pass ? 0 : 1;
}

main().catch((err: unknown) => {
  console.error("card-QA harness failed:", err);
  process.exit(1);
});
