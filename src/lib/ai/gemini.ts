import { GoogleGenAI } from "@google/genai";
import type { Part, Schema } from "@google/genai";
import { AiError, type AiFailureKind } from "./errors.ts";

/**
 * Server-side only. This is the one module that holds the Gemini key, and it is
 * imported by the worker and the eval script, never by the browser bundle.
 * The key used to be a VITE_ variable, which Vite compiles into the public JS.
 */

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
export const MODEL_CHAIN = [
  "gemini-3.5-flash",
  "gemini-3.6-flash",
  "gemini-3.8-flash",
  "gemini-3.1-flash-lite",
  "gemini-3-flash-preview",
] as const;

const RETRIES_ON_OVERLOAD = 1;
const BASE_BACKOFF_MS = 800;

/**
 * A normal call takes 2 to 17 seconds. Under load Gemini's own errors are slow
 * too (503s took up to 36s and a 504 took 41s in testing), but they do end.
 * This cap is for an attempt that never answers at all, which would otherwise
 * hold the whole request. Timing out moves on to the next model, like any
 * other non-quota failure.
 */
const ATTEMPT_TIMEOUT_MS = 45_000;

export interface GenerateRequest {
  /** Text and/or inline file data. Gemini reads PDFs natively from a part. */
  parts: Part[];
  schema: Schema;
  /** 0 disables thinking. Measured at a 42% latency cut with no quality loss
   *  on question generation; raise it for tasks that need reasoning. */
  thinkingBudget?: number;
  signal?: AbortSignal;
}

/**
 * A JSON-schema-constrained generation. Everything above the transport takes
 * one of these as a parameter instead of importing a client, so the same
 * grading code runs in the worker, in `pnpm eval`, and against a fake in tests.
 */
export type Generate = <T>(request: GenerateRequest) => Promise<T>;

export interface GenerateAttempt {
  model: string;
  ms: number;
  /** Absent when the attempt succeeded. */
  error?: string;
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
 * Builds a {@link Generate} that runs against the model chain.
 *
 * Structured output is what makes this safe: the API is told the exact shape to
 * return, so there is no markdown fence to strip and no JSON array to find with
 * a regex.
 *
 * Each call is independent. A module-level startChat() would share one history
 * across every question in a session, so feedback for question five would be
 * produced with questions one to four still in context.
 */
export function createGemini(
  apiKey: string,
  {
    onAttempt,
  }: {
    /** Called after every HTTP request to Gemini, retries and fallbacks
     *  included, so a caller can log where the time went and count what a
     *  run actually cost against the quota. */
    onAttempt?: (attempt: GenerateAttempt) => void;
  } = {}
): Generate {
  if (!apiKey) {
    throw new Error(
      "Missing GEMINI_API_KEY. Add a key from https://aistudio.google.com/apikey to .env (local) or as a Worker secret (production)."
    );
  }

  const ai = new GoogleGenAI({ apiKey });

  return async function generate<T>({
    parts,
    schema,
    thinkingBudget = 0,
    signal,
  }: GenerateRequest): Promise<T> {
    let sawRateLimit = false;
    let soonestRetry: number | undefined;
    let lastError: unknown;

    for (const model of MODEL_CHAIN) {
      for (let attempt = 0; attempt <= RETRIES_ON_OVERLOAD; attempt++) {
        if (signal?.aborted) throw new AiError("unknown", "Request cancelled");

        const startedAt = Date.now();
        try {
          const response = await ai.models.generateContent({
            model,
            contents: [{ role: "user", parts }],
            config: {
              responseMimeType: "application/json",
              responseSchema: schema,
              thinkingConfig: { thinkingBudget },
              abortSignal: signal,
              httpOptions: { timeout: ATTEMPT_TIMEOUT_MS },
            },
          });

          // Not `response.text`: with thinking on, that getter logs a warning
          // about the thought-signature parts on every single call.
          const text = response.candidates?.[0]?.content?.parts
            ?.filter((part) => typeof part.text === "string" && !part.thought)
            .map((part) => part.text)
            .join("");
          if (!text) throw new AiError("malformed", "Model returned an empty response");

          try {
            const parsed = JSON.parse(text) as T;
            onAttempt?.({ model, ms: Date.now() - startedAt });
            return parsed;
          } catch {
            throw new AiError("malformed", "Model returned output that was not valid JSON");
          }
        } catch (error) {
          lastError = error;
          onAttempt?.({ model, ms: Date.now() - startedAt, error: rawOf(error).slice(0, 160) });

          if (error instanceof AiError && error.kind === "malformed") {
            break; // a schema violation will not fix itself on the same model
          }

          const kind = classify(error);

          if (kind === "auth") {
            throw new AiError(
              "auth",
              "The server's Gemini API key was rejected. Check the GEMINI_API_KEY secret."
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
  };
}
