import type { z } from "zod";
import {
  feedbackRequest,
  questionsRequest,
  resumeRequest,
  type AiTask,
} from "../src/lib/ai/contract.ts";
import { AiError, type AiErrorBody, type AiFailureKind } from "../src/lib/ai/errors.ts";
import { createGemini, type Generate } from "../src/lib/ai/gemini.ts";
import { generateFeedback, generateQuestions } from "../src/lib/ai/interview.ts";
import { extractResume } from "../src/lib/ai/resume.ts";
import { AuthError, verifyFirebaseIdToken } from "./auth.ts";

export { RateLimiter } from "./rate-limit.ts";

/**
 * The AI API. The browser sends what it wants done; this worker holds the
 * Gemini key, decides the prompt, and makes the call. It deliberately does not
 * accept a raw prompt: a "send any prompt" endpoint behind a free sign-up is an
 * open proxy with extra steps.
 *
 * Every request passes the same gates, cheapest first, so a request that is
 * going to be refused costs no Gemini quota:
 *   origin -> ID token -> per-user rate limit -> body shape -> the task.
 */

// The resume route carries a base64 PDF: 5MB of file is about 6.7MB of text.
const MAX_BODY_BYTES = 8 * 1024 * 1024;

interface Route<S extends z.ZodType, R> {
  body: S;
  run: (generate: Generate, input: z.output<S>, signal: AbortSignal) => Promise<R>;
}

const route = <S extends z.ZodType, R>(body: S, run: Route<S, R>["run"]): Route<S, R> => ({
  body,
  run,
});

const ROUTES: Record<AiTask, Route<z.ZodType, unknown>> = {
  questions: route(questionsRequest, (generate, { brief, resume }, signal) =>
    generateQuestions(generate, brief, resume, signal)
  ),
  feedback: route(feedbackRequest, (generate, input, signal) =>
    generateFeedback(generate, input, signal)
  ),
  resume: route(resumeRequest, (generate, input, signal) =>
    extractResume(generate, input, signal)
  ),
};

/** Status for an AiError the model layer raised. `auth` there means the
 *  server's own Gemini key, so it is a 502, not the caller's fault. */
const STATUS: Record<AiFailureKind, number> = {
  overloaded: 503,
  rate_limited: 429,
  auth: 502,
  malformed: 502,
  unknown: 500,
};

const allowedOrigins = (env: Env) => env.ALLOWED_ORIGINS.split(",").map((o) => o.trim());

function corsHeaders(request: Request, env: Env): Headers {
  const headers = new Headers({ Vary: "Origin" });
  const origin = request.headers.get("Origin");
  if (origin && allowedOrigins(env).includes(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
    headers.set("Access-Control-Max-Age", "86400");
    // Without this a browser hides Retry-After from the page, even on a 429.
    headers.set("Access-Control-Expose-Headers", "Retry-After");
  }
  return headers;
}

function json(body: unknown, status: number, headers: Headers): Response {
  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(body), { status, headers });
}

function fail(
  status: number,
  kind: AiFailureKind,
  message: string,
  headers: Headers,
  retryAfterSeconds?: number
): Response {
  if (retryAfterSeconds) headers.set("Retry-After", String(retryAfterSeconds));
  const body: AiErrorBody = { error: { kind, message, retryAfterSeconds } };
  return json(body, status, headers);
}

const minutesFrom = (seconds: number) => Math.max(1, Math.ceil(seconds / 60));

export default {
  async fetch(request, env): Promise<Response> {
    const cors = corsHeaders(request, env);

    // CORS only stops a browser reading the response, not the request running.
    // A foreign page has no ID token to send, but refusing it here means it
    // cannot even spend a token check. No Origin at all is a server-side
    // caller (curl, a test harness), which still has to authenticate.
    if (request.headers.has("Origin") && !cors.has("Access-Control-Allow-Origin")) {
      return fail(403, "auth", "This site is not allowed to use the interviewer API.", cors);
    }
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    const task = new URL(request.url).pathname.replace(/^\/+|\/+$/g, "");
    if (!Object.hasOwn(ROUTES, task)) return fail(404, "unknown", "Not found.", cors);
    if (request.method !== "POST") return fail(405, "unknown", "Use POST.", cors);
    const { body: schema, run } = ROUTES[task as AiTask];

    const token = request.headers.get("Authorization")?.match(/^Bearer\s+(\S+)$/)?.[1];
    if (!token) return fail(401, "auth", "Sign in to use the interviewer.", cors);

    let uid: string;
    try {
      uid = await verifyFirebaseIdToken(token, env.FIREBASE_PROJECT_ID);
    } catch (error) {
      if (!(error instanceof AuthError)) throw error;
      console.warn(`Rejected ID token: ${error.message}`);
      return fail(401, "auth", "Your sign-in has expired. Sign in again to continue.", cors);
    }

    const limit = Number(env.RATE_LIMIT_REQUESTS);
    const windowSeconds = Number(env.RATE_LIMIT_WINDOW_SECONDS);
    const quota = await env.RATE_LIMITER.getByName(uid).consume(limit, windowSeconds);
    if (!quota.allowed) {
      return fail(
        429,
        "rate_limited",
        `You have used all ${limit} AI requests for this hour. Try again in about ${minutesFrom(
          quota.retryAfterSeconds
        )} minutes.`,
        cors,
        quota.retryAfterSeconds
      );
    }

    if (Number(request.headers.get("Content-Length") ?? 0) > MAX_BODY_BYTES) {
      return fail(413, "unknown", "That request is too large.", cors);
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return fail(400, "unknown", "The request body was not valid JSON.", cors);
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return fail(400, "unknown", "The request was missing something it needs.", cors);
    }

    try {
      const result = await run(createGemini(env.GEMINI_API_KEY), parsed.data, request.signal);
      return json(result, 200, cors);
    } catch (error) {
      if (error instanceof AiError) {
        return fail(STATUS[error.kind], error.kind, error.message, cors, error.retryAfterSeconds);
      }
      console.error(`Task "${task}" failed for ${uid}`, error);
      return fail(500, "unknown", "Something went wrong on the server. Please try again.", cors);
    }
  },
} satisfies ExportedHandler<Env>;
