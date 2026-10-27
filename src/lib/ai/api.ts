import { auth } from "@/config/firebase.config";
import {
  ACCEPTED_RESUME_TYPES,
  MAX_RESUME_BYTES,
  type AiTask,
  type AiTasks,
} from "./contract.ts";
import { AiError, type AiErrorBody } from "./errors.ts";
import type { InterviewBrief } from "./interview.ts";
import type { ResumeProfile } from "./resume.ts";

/**
 * The browser's only way to the model. Every call goes to the worker in
 * `worker/`, which holds the Gemini key, checks the caller's Firebase ID token
 * and applies a per-user rate limit. Nothing here imports @google/genai, so
 * neither the SDK nor a key can end up in the bundle.
 */

const API_URL = import.meta.env.VITE_AI_API_URL as string | undefined;

async function call<K extends AiTask>(
  task: K,
  body: AiTasks[K]["request"],
  signal?: AbortSignal
): Promise<AiTasks[K]["response"]> {
  if (!API_URL) {
    throw new AiError(
      "unknown",
      "Missing VITE_AI_API_URL. Copy .env.example to .env and point it at the worker (pnpm dev:api serves http://localhost:8787)."
    );
  }

  const user = auth.currentUser;
  if (!user) throw new AiError("auth", "Your session has ended. Sign in again to continue.");

  let response: Response;
  try {
    response = await fetch(`${API_URL}/${task}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // getIdToken refreshes the token itself when it is near expiry.
        Authorization: `Bearer ${await user.getIdToken()}`,
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw new AiError("unknown", "Request cancelled");
    console.error(`AI request "${task}" did not reach the server`, error);
    throw new AiError("unknown", "Could not reach the server. Check your connection and try again.");
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as AiErrorBody | null;
    const error = payload?.error;
    throw new AiError(
      error?.kind ?? (response.status === 429 ? "rate_limited" : "unknown"),
      error?.message ?? `The server answered ${response.status}. Please try again.`,
      error?.retryAfterSeconds
    );
  }

  return (await response.json()) as AiTasks[K]["response"];
}

export const generateQuestions = (
  brief: InterviewBrief,
  resume?: ResumeProfile | null,
  signal?: AbortSignal
) => call("questions", { brief, resume }, signal);

/** A main answer: the grade, the CV claim check and at most one follow-up. */
export const assessAnswer = (input: AiTasks["assess"]["request"], signal?: AbortSignal) =>
  call("assess", input, signal);

/** The main answer and the follow-up answer together, graded as one. */
export const gradeAnswer = (input: AiTasks["grade"]["request"], signal?: AbortSignal) =>
  call("grade", input, signal);

export { ACCEPTED_RESUME_TYPES, MAX_RESUME_BYTES };

export function validateResumeFile(file: File): string | null {
  if (!(ACCEPTED_RESUME_TYPES as readonly string[]).includes(file.type)) {
    return "That file is not a PDF. Export your CV as a PDF and try again.";
  }
  if (file.size > MAX_RESUME_BYTES) {
    return "That PDF is larger than 5MB. Most CVs are well under 1MB.";
  }
  if (file.size === 0) {
    return "That file is empty.";
  }
  return null;
}

const fileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new AiError("unknown", "Could not read that file"));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new AiError("unknown", "Could not read that file"));
        return;
      }
      // Strip the "data:application/pdf;base64," prefix.
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.readAsDataURL(file);
  });

export async function extractResume(file: File, signal?: AbortSignal): Promise<ResumeProfile> {
  const invalid = validateResumeFile(file);
  if (invalid) throw new AiError("unknown", invalid);

  const data = await fileToBase64(file);
  return call("resume", { mimeType: file.type as "application/pdf", data }, signal);
}
