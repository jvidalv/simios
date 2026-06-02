import { z } from "zod";
import { postGenerateContent } from "./request.js";

const InlineDataSchema = z.object({
  inlineData: z.object({
    mimeType: z.string().min(1),
    data: z.string().min(1),
  }),
});

const TextPartSchema = z.object({
  text: z.string(),
});

const PartSchema = z.union([InlineDataSchema, TextPartSchema]);

const ResponseSchema = z.object({
  candidates: z
    .array(
      z.object({
        content: z.object({
          parts: z.array(PartSchema),
        }),
      }),
    )
    .min(1),
});

export interface GeminiImage {
  readonly mimeType: string;
  readonly bytes: Buffer;
}

export interface GeminiImageClient {
  generate(prompt: string): Promise<GeminiImage>;
}

// Hard cap on a single image request. Without it, a hung upstream call holds
// the bot's in-flight latch forever (every later trigger is silently dropped
// until restart) and stalls the QA harness mid-batch.
const REQUEST_TIMEOUT_MS = 90_000;

export function createGeminiImageClient(params: {
  readonly apiKey: string;
  readonly model: string;
}): GeminiImageClient {
  return {
    async generate(prompt: string): Promise<GeminiImage> {
      const raw = await postGenerateContent({
        apiKey: params.apiKey,
        model: params.model,
        body: { contents: [{ parts: [{ text: prompt }] }] },
        timeoutMs: REQUEST_TIMEOUT_MS,
      });
      const parsed = ResponseSchema.safeParse(raw);
      if (!parsed.success) {
        throw new Error(
          `Gemini response did not match expected shape: ${parsed.error.message}`,
        );
      }
      for (const candidate of parsed.data.candidates) {
        for (const part of candidate.content.parts) {
          if ("inlineData" in part) {
            return {
              mimeType: part.inlineData.mimeType,
              bytes: Buffer.from(part.inlineData.data, "base64"),
            };
          }
        }
      }
      throw new Error("Gemini response contained no inline image data");
    },
  };
}
