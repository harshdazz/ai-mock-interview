/**
 * Shared by the browser, the worker and the eval script, so it imports nothing.
 * The worker sends these over the wire as {@link AiErrorBody} and the browser
 * rebuilds the same class, which keeps every `instanceof AiError` check in the
 * UI working unchanged.
 */
export type AiFailureKind =
  | "overloaded" // 503: transient, worth retrying
  | "rate_limited" // 429: daily quota spent on every model, or this user's limit
  | "auth" // 400/401/403: bad or restricted key, or an expired sign-in
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

export interface AiErrorBody {
  error: { kind: AiFailureKind; message: string; retryAfterSeconds?: number };
}
