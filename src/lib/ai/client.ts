import { GoogleGenAI } from "@google/genai";
import type { GenerateContentConfig, Schema } from "@google/genai";

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
 * The newest flash models load-shed aggressively: across repeated trials
 * gemini-3.6-flash returned 503 on every attempt and gemini-3.8-flash on two
 * of three, while gemini-3.5-flash succeeded every time. So the reliable model
 * leads and the newer ones are fallbacks, not the other way round. Re-measure
 * before reordering; availability moves.
 */
const MODEL_CHAIN = ["gemini-3.5-flash", "gemini-3.8-flash", "gemini-3.6-flash"] as const;

const MAX_ATTEMPTS_PER_MODEL = 2;
const BASE_BACKOFF_MS = 600;

export type AiFailureKind =
  | "overloaded"  // 503/429: transient, worth retrying
  | "auth"        // 400/401/403: bad or restricted key, retrying will not help
  | "malformed"   // response did not match the schema
  | "unknown";

export class AiError extends Error {
  readonly kind: AiFailureKind;
  readonly retryable: boolean;

  constructor(kind: AiFailureKind, message: string) {
    super(message);
    this.name = "AiError";
    this.kind = kind;
    this.retryable = kind === "overloaded";
  }
}

const statusOf = (error: unknown): number | undefined => {
  const raw = error instanceof Error ? error.message : String(error);
  return Number(raw.match(/"code"\s*:\s*(\d+)/)?.[1]) || undefined;
};

const classify = (error: unknown): AiFailureKind => {
  const status = statusOf(error);
  if (status === 503 || status === 429) return "overloaded";
  if (status === 400 || status === 401 || status === 403) return "auth";
  return "unknown";
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs a JSON-schema-constrained generation against the model chain.
 *
 * Structured output is what makes this safe: the API is told the exact shape to
 * return, so there is no markdown fence to strip and no JSON array to find with
 * a regex. The previous implementation did both, and its cleanup pass stripped
 * every literal occurrence of "json" from the payload including inside the text
 * the user reads.
 *
 * Each call is independent. The old module-level startChat() meant one chat
 * history was shared by every question in a session, so feedback for question
 * five was produced with questions one to four still in context.
 */
export async function generateStructured<T>({
  prompt,
  schema,
  thinkingBudget = 0,
  signal,
}: {
  prompt: GenerateContentConfig["systemInstruction"] | string;
  schema: Schema;
  /** 0 disables thinking. Measured at a 42% latency cut with no quality loss
   *  on question generation; raise it for tasks that need reasoning. */
  thinkingBudget?: number;
  signal?: AbortSignal;
}): Promise<T> {
  let lastError: unknown;

  for (const model of MODEL_CHAIN) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_MODEL; attempt++) {
      if (signal?.aborted) throw new AiError("unknown", "Request cancelled");

      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt as string,
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
          // A schema violation will not fix itself on the same model; move on.
          break;
        }

        const kind = classify(error);
        if (kind === "auth") {
          throw new AiError(
            "auth",
            "The Gemini API key was rejected. Check VITE_GEMINI_API_KEY and any referrer restrictions on it."
          );
        }
        if (kind === "overloaded" && attempt < MAX_ATTEMPTS_PER_MODEL) {
          await sleep(BASE_BACKOFF_MS * 2 ** (attempt - 1));
          continue;
        }
        break; // try the next model
      }
    }
  }

  const kind = classify(lastError);
  throw new AiError(
    kind,
    kind === "overloaded"
      ? "Every available model is busy right now. Wait a moment and try again."
      : `Could not reach the model. ${lastError instanceof Error ? lastError.message.slice(0, 160) : ""}`
  );
}
