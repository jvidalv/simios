import { z } from "zod";
import { postGenerateContent } from "./request.js";

/**
 * Minimal Gemini text client — tractorbot only needs structured JSON
 * generation (the card namer). Mirrors rpvbot's client: disables the
 * model's internal "thinking" budget (it shares maxOutputTokens and would
 * silently truncate the reply), times out hung requests, and validates the
 * envelope shape. The CALLER zod-validates the decoded JSON.
 */

const CandidateSchema = z.object({
  content: z
    .object({
      parts: z.array(z.object({ text: z.string() })).optional(),
    })
    .optional(),
  finishReason: z.string().optional(),
});

const ResponseSchema = z.object({
  candidates: z.array(CandidateSchema).min(1),
});

/** A Gemini "responseSchema" decoding hint — not a zod schema. */
export type GeminiResponseSchema = Record<string, unknown>;

export interface GeminiTextClient {
  /** Structured generation. Returns parsed-but-unvalidated JSON. */
  generateJson(args: {
    readonly system: string;
    readonly user: string;
    readonly responseSchema: GeminiResponseSchema;
    readonly temperature?: number;
  }): Promise<unknown>;
}

const REQUEST_TIMEOUT_MS = 30_000;

export function createGeminiTextClient(params: {
  readonly apiKey: string;
  readonly model: string;
}): GeminiTextClient {
  async function generate(args: {
    system: string;
    user: string;
    responseSchema: GeminiResponseSchema;
    temperature?: number;
  }): Promise<string> {
    const generationConfig: Record<string, unknown> = {
      temperature: args.temperature ?? 0.9,
      maxOutputTokens: 400,
      thinkingConfig: { thinkingBudget: 0 },
      responseMimeType: "application/json",
      responseSchema: args.responseSchema,
    };

    const raw = await postGenerateContent({
      apiKey: params.apiKey,
      model: params.model,
      timeoutMs: REQUEST_TIMEOUT_MS,
      body: {
        systemInstruction: { parts: [{ text: args.system }] },
        contents: [{ role: "user", parts: [{ text: args.user }] }],
        generationConfig,
      },
    });
    const parsed = ResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(
        `Gemini response did not match expected shape: ${parsed.error.message}`,
      );
    }
    const candidate = parsed.data.candidates[0];
    if (candidate === undefined) {
      throw new Error("Gemini returned no candidates");
    }
    const text = (candidate.content?.parts ?? [])
      .map((p) => p.text)
      .join("")
      .trim();
    const finishReason = candidate.finishReason ?? "UNKNOWN";
    if (finishReason !== "STOP") {
      throw new Error(
        `Gemini truncated reply (finishReason=${finishReason}, ` +
          `text="${text.slice(0, 120)}${text.length > 120 ? "…" : ""}")`,
      );
    }
    if (text.length === 0) {
      throw new Error("Gemini returned empty text with STOP");
    }
    return text;
  }

  return {
    async generateJson({ system, user, responseSchema, temperature }) {
      const text = await generate({
        system,
        user,
        responseSchema,
        ...(temperature !== undefined ? { temperature } : {}),
      });
      try {
        return JSON.parse(text);
      } catch {
        throw new Error(
          `Gemini returned non-JSON despite responseSchema: ` +
            `"${text.slice(0, 120)}${text.length > 120 ? "…" : ""}"`,
        );
      }
    },
  };
}
