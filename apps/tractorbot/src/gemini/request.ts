/**
 * Shared request plumbing for the three tractorbot Gemini clients (image,
 * text, vision). They differ in request body and response shape — those stay
 * per-client — but the URL, headers, abort-timeout, and HTTP-error handling
 * are identical, so they live here once.
 */

function endpointUrl(model: string): string {
  return (
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${encodeURIComponent(model)}:generateContent`
  );
}

/**
 * POST a `generateContent` body and return the raw JSON. Aborts after
 * `timeoutMs` (a hung call would otherwise hold the bot's in-flight latch
 * forever), turns an abort into a clear "timed out" error, and throws on a
 * non-2xx response with a truncated body.
 */
export async function postGenerateContent(params: {
  readonly apiKey: string;
  readonly model: string;
  readonly body: unknown;
  readonly timeoutMs: number;
}): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, params.timeoutMs);
  let response: Response;
  try {
    response = await fetch(endpointUrl(params.model), {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": params.apiKey,
      },
      body: JSON.stringify(params.body),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(
        `Gemini request timed out after ${String(params.timeoutMs)}ms`,
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Gemini ${String(response.status)} ${response.statusText}: ${body.slice(0, 500)}`,
    );
  }
  return response.json();
}
