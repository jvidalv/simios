import { z } from "zod";
import { postGenerateContent } from "./request.js";

/**
 * Vision QA for generated cards. Sends an image to a Gemini vision model and
 * asks three closed questions: is this ONE framed trading card, what is the
 * dominant border colour, and what surface finish does it read as. Used by the
 * dev-only image-QA harness to score border/surface accuracy across a batch —
 * NOT on the hot path.
 */

const VERDICT_COLORS = [
  "gray",
  "blue",
  "yellow",
  "orange",
  "purple",
  "other",
] as const;
const VERDICT_FINISHES = ["matte", "weathered", "foil", "other"] as const;

export const CardVerdictSchema = z.object({
  is_card: z.boolean(),
  border_color: z.enum(VERDICT_COLORS),
  surface_finish: z.enum(VERDICT_FINISHES),
});
export type CardVerdict = z.infer<typeof CardVerdictSchema>;

const ResponseSchema = z.object({
  candidates: z
    .array(
      z.object({
        content: z
          .object({ parts: z.array(z.object({ text: z.string() })).optional() })
          .optional(),
        finishReason: z.string().optional(),
      }),
    )
    .min(1),
});

const SYSTEM = `You are a strict visual QA grader for collectible trading-card images. Answer only about what is literally visible. Return JSON.`;

const USER = `Look at this image and answer:
- is_card: true ONLY if the image is ONE framed trading card (a bordered card with a title banner), filling the frame — false if it's a loose illustration, multiple cards, or a card-within-a-card.
- border_color: the dominant colour of the card's outer border (gray, blue, yellow, orange, purple, or other).
- surface_finish: the card's finish — matte (clean/flat), weathered (worn/embossed/aged), foil (glossy/holographic/shiny), or other.`;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    is_card: { type: "boolean" },
    border_color: { type: "string", enum: [...VERDICT_COLORS] },
    surface_finish: { type: "string", enum: [...VERDICT_FINISHES] },
  },
  required: ["is_card", "border_color", "surface_finish"],
};

export interface CardVisionClient {
  verify(image: { mimeType: string; base64: string }): Promise<CardVerdict>;
}

const REQUEST_TIMEOUT_MS = 30_000;

export function createCardVisionClient(params: {
  readonly apiKey: string;
  readonly model: string;
}): CardVisionClient {
  return {
    async verify(image): Promise<CardVerdict> {
      const raw = await postGenerateContent({
        apiKey: params.apiKey,
        model: params.model,
        timeoutMs: REQUEST_TIMEOUT_MS,
        body: {
          systemInstruction: { parts: [{ text: SYSTEM }] },
          contents: [
            {
              role: "user",
              parts: [
                {
                  inlineData: { mimeType: image.mimeType, data: image.base64 },
                },
                { text: USER },
              ],
            },
          ],
          generationConfig: {
            temperature: 0,
            thinkingConfig: { thinkingBudget: 0 },
            responseMimeType: "application/json",
            responseSchema: RESPONSE_SCHEMA,
          },
        },
      });
      const env = ResponseSchema.parse(raw);
      const text = (env.candidates[0]?.content?.parts ?? [])
        .map((p) => p.text)
        .join("")
        .trim();
      const json: unknown = JSON.parse(text);
      return CardVerdictSchema.parse(json);
    },
  };
}
