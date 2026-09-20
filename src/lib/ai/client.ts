import { GoogleGenAI } from "@google/genai";
import type { Part, Schema } from "@google/genai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

if (!apiKey) {
  throw new Error(
    "Missing VITE_GEMINI_API_KEY. Copy .env.example to .env and add a key from https://aistudio.google.com/apikey"
  );
}

const ai = new GoogleGenAI({ apiKey });

/**
 * Model preference order, measured against a free-tier key rather than assumed.
 *
 * Two independent failure modes matter here, and they are not the same thing:
 *
 *   429 RESOURCE_EXHAUSTED - the free tier allows 20 requests per model per
 *   day. Once a model is spent it stays spent, so retrying it inside one
 *   request is pure waste. The quota is per model, which is exactly why this
 *   chain exists: falling through to the next model buys another 20.
 *
 *   503 UNAVAILABLE - transient load shedding. Worth one retry on the same
 *   model before moving on.
 *
 * Availability moves; re-measure before reordering. gemini-3.5-flash-lite is
 * deliberately absent: it rejects this request shape with a 400.
 */
const MODEL_CHAIN = [
  "gemini-3.5-flash",
  "gemini-3.6-flash",
  "gemini-3.8-flash",
  "gemini-3.1-flash-lite",
  "gemini-3-flash-preview",
] as const;

const RETRIES_ON_OVERLOAD = 1;
const BASE_BACKOFF_MS = 800;

export type AiFailureKind =
  | "overloaded" // 503: transient, worth retrying
  | "rate_limited" // 429: daily quota spent on every model
  | "auth" // 400/401/403: bad or restricted key
  | "malformed" // response did not match the schema
  | "unknown";

export class AiError extends Error {
  readonly kind: AiFailureKind;
  readonly retryable: boolean;
  /** Seconds until the quota window reopens, when the API told us. */
  readonly retryAfterSeconds?: number;

  constructor(kind: AiFailureKind, message: string, retryAfterSeconds?: number) {
    super(message);
    this.name = "AiError";
    this.kind = kind;
    this.retryable = kind === "overloaded" || kind === "rate_limited";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

const rawOf = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const statusOf = (error: unknown): number | undefined =>
  Number(rawOf(error).match(/"code"\s*:\s*(\d+)/)?.[1]) || undefined;

/** Gemini returns a RetryInfo detail such as {"retryDelay":"48s"}. */
const retryAfterOf = (error: unknown): number | undefined => {
  const raw = rawOf(error);
  const fromDetail = raw.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/)?.[1];
  if (fromDetail) return Math.ceil(Number(fromDetail));
  const fromText = raw.match(/retry in (\d+(?:\.\d+)?)s/i)?.[1];
  return fromText ? Math.ceil(Number(fromText)) : undefined;
};

const classify = (error: unknown): AiFailureKind => {
  const status = statusOf(error);
  if (status === 429) return "rate_limited";
  if (status === 503 || status === 500 || status === 502) return "overloaded";
  if (status === 401 || status === 403) return "auth";
  return "unknown";
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const formatWait = (seconds?: number) => {
  if (!seconds) return "";
  if (seconds < 90) return ` Try again in about ${seconds} seconds.`;
  return ` Try again in about ${Math.ceil(seconds / 60)} minutes.`;
};

/**
 * Runs a JSON-schema-constrained generation against the model chain.
 *
 * Structured output is what makes this safe: the API is told the exact shape to
 * return, so there is no markdown fence to strip and no JSON array to find with
 * a regex.
 *
 * Each call is independent. A module-level startChat() would share one history
 * across every question in a session, so feedback for question five would be
 * produced with questions one to four still in context.
 */
export async function generateFromParts<T>({
  parts,
  schema,
  thinkingBudget = 0,
  signal,
}: {
  /** Text and/or inline file data. Gemini reads PDFs natively from a part. */
  parts: Part[];
  schema: Schema;
  /** 0 disables thinking. Measured at a 42% latency cut with no quality loss
   *  on question generation; raise it for tasks that need reasoning. */
  thinkingBudget?: number;
  signal?: AbortSignal;
}): Promise<T> {
  let sawRateLimit = false;
  let soonestRetry: number | undefined;
  let lastError: unknown;

  for (const model of MODEL_CHAIN) {
    for (let attempt = 0; attempt <= RETRIES_ON_OVERLOAD; attempt++) {
      if (signal?.aborted) throw new AiError("unknown", "Request cancelled");

      try {
        const response = await ai.models.generateContent({
          model,
          contents: [{ role: "user", parts }],
          config: {
            responseMimeType: "application/json",
            responseSchema: schema,
            thinkingConfig: { thinkingBudget },
            abortSignal: signal,
          },
        });

        const text = response.text;
        if (!text) throw new AiError("malformed", "Model returned an empty response");

        try {
          return JSON.parse(text) as T;
        } catch {
          throw new AiError("malformed", "Model returned output that was not valid JSON");
        }
      } catch (error) {
        lastError = error;

        if (error instanceof AiError && error.kind === "malformed") {
          break; // a schema violation will not fix itself on the same model
        }

        const kind = classify(error);

        if (kind === "auth") {
          throw new AiError(
            "auth",
            "The Gemini API key was rejected. Check VITE_GEMINI_API_KEY and any referrer restrictions on it."
          );
        }

        if (kind === "rate_limited") {
          // This model's daily allowance is gone. Retrying it now would only
          // spend more of the budget on a guaranteed failure.
          sawRateLimit = true;
          const after = retryAfterOf(error);
          if (after && (soonestRetry === undefined || after < soonestRetry)) {
            soonestRetry = after;
          }
          break;
        }

        if (kind === "overloaded" && attempt < RETRIES_ON_OVERLOAD) {
          await sleep(BASE_BACKOFF_MS * 2 ** attempt);
          continue;
        }

        break; // move to the next model
      }
    }
  }

  if (sawRateLimit) {
    throw new AiError(
      "rate_limited",
      `The Gemini free tier allows 20 requests per model per day, and every model in the fallback chain is now spent.${formatWait(
        soonestRetry
      )} Enabling billing on the API key removes this limit.`,
      soonestRetry
    );
  }

  const kind = classify(lastError);
  throw new AiError(
    kind,
    kind === "overloaded"
      ? "Every available model is busy right now. This usually clears within a minute."
      : `Could not reach the model. ${
          lastError instanceof Error ? lastError.message.slice(0, 160) : ""
        }`
  );
}

/** Text-only convenience wrapper over {@link generateFromParts}. */
export function generateStructured<T>({
  prompt,
  schema,
  thinkingBudget = 0,
  signal,
}: {
  prompt: string;
  schema: Schema;
  thinkingBudget?: number;
  signal?: AbortSignal;
}): Promise<T> {
  return generateFromParts<T>({
    parts: [{ text: prompt }],
    schema,
    thinkingBudget,
    signal,
  });
}
