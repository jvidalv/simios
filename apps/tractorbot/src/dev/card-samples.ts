/**
 * Dev-only sample generator (NOT shipped). Generates a spread of cards and
 * writes the PNGs to a local folder so the style can be eyeballed. Uses the
 * real naming + prompt pipeline (so names/concepts match shipping behaviour),
 * but no Telegram and no sheet.
 *
 *   GEMINI_API_KEY=… pnpm -F tractorbot gen:samples [count] [outDir]
 *
 * Files are named NN-theme-border-surface-<slug>.png so the rarity is obvious
 * at a glance in the folder.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createGeminiImageClient } from "../gemini/image.js";
import { createGeminiTextClient } from "../gemini/text.js";
import { createCardNamer } from "../prompt/card-namer.js";
import { buildPromptParts, renderPrompt } from "../domain/prompt.js";
import {
  BorderSchema,
  SurfaceSchema,
  type Border,
  type Surface,
} from "../domain/rarity.js";
import { seeded } from "./seeded.js";
import { rollCardType } from "../domain/card-type.js";
import type { ImageTheme } from "../domain/theme.js";

const IMAGE_MODEL = process.env["GEMINI_MODEL"] ?? "gemini-2.5-flash-image";
const TEXT_MODEL = process.env["GEMINI_TEXT_MODEL"] ?? "gemini-2.5-flash";

interface Sample {
  readonly theme: ImageTheme;
  readonly border: Border;
  readonly surface: Surface;
  readonly seed: number;
}

/** A varied spread across tiers and themes, capped at `count`. */
function buildSamples(count: number): Sample[] {
  const borders = BorderSchema.options;
  const surfaces = SurfaceSchema.options;
  const themes: ImageTheme[] = ["tractor", "luddite"];
  const out: Sample[] = [];
  for (let i = 0; i < count; i++) {
    const border = borders[i % borders.length];
    const surface = surfaces[i % surfaces.length];
    const theme = themes[i % themes.length];
    if (border === undefined || surface === undefined || theme === undefined) {
      continue;
    }
    out.push({ theme, border, surface, seed: i + 1 });
  }
  return out;
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

async function main(): Promise<void> {
  const apiKey = process.env["GEMINI_API_KEY"];
  if (apiKey === undefined || apiKey.length === 0) {
    throw new Error("GEMINI_API_KEY is required to generate samples");
  }
  const count = Math.max(1, Math.floor(Number(process.argv[2] ?? "10")) || 10);
  const outDir = process.argv[3] ?? "card-samples";

  const image = createGeminiImageClient({ apiKey, model: IMAGE_MODEL });
  const namer = createCardNamer(
    createGeminiTextClient({ apiKey, model: TEXT_MODEL }),
  );

  await mkdir(outDir, { recursive: true });
  const samples = buildSamples(count);
  const usedNames: string[] = [];

  let n = 0;
  for (const s of samples) {
    n++;
    const parts = buildPromptParts(s.theme, seeded(s.seed));
    const cardType = rollCardType(seeded(s.seed * 7 + 3));
    const data = await namer.name({
      theme: s.theme,
      cardType,
      border: s.border,
      surface: s.surface,
      avoid: usedNames,
    });
    usedNames.push(data.name);
    const prompt = renderPrompt({
      parts,
      cardType,
      ...data,
      border: s.border,
      surface: s.surface,
    });
    const idx = String(n).padStart(2, "0");
    const tag = `${cardType}/${s.theme}/${s.border}/${s.surface}`;
    process.stdout.write(
      `[${idx}/${String(samples.length)}] ${tag} "${data.name}" … `,
    );
    try {
      const img = await image.generate(prompt);
      const file = join(
        outDir,
        `${idx}-${cardType}-${s.theme}-${s.border}-${s.surface}-${slug(data.name)}.png`,
      );
      await writeFile(file, img.bytes);
      console.log(`saved ${file}`);
    } catch (err) {
      console.log(`ERROR ${String(err)}`);
    }
  }
  console.log(`\nDone. ${String(samples.length)} samples in ./${outDir}/`);
}

main().catch((err: unknown) => {
  console.error("sample generator failed:", err);
  process.exit(1);
});
