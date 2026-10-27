import { z } from "zod";
import type { AnswerFeedback, GeneratedQuestion } from "./interview.ts";
import type { ResumeProfile } from "./resume.ts";

/**
 * The HTTP contract between the browser and the worker. Both sides import it,
 * so it must stay free of anything that pulls Gemini into the browser bundle:
 * zod and type-only imports, nothing else.
 *
 * Every request body is user-controlled, so the worker parses it with these
 * schemas before any of it reaches a prompt. The caps are generous for real
 * use and exist to stop one request spending a large share of the quota.
 */

export const MAX_RESUME_BYTES = 5 * 1024 * 1024;
export const ACCEPTED_RESUME_TYPES = ["application/pdf"] as const;

const text = (max: number) => z.string().trim().max(max);
const list = <T extends z.ZodType>(max: number, item: T) => z.array(item).max(max);

const resumeProfile = z.object({
  currentRole: text(300),
  yearsExperience: z.number().min(0).max(80),
  techStack: list(80, text(100)),
  projects: list(
    30,
    z.object({
      name: text(300),
      whatTheyDid: text(2000),
      tech: list(40, text(100)),
    })
  ),
  talkingPoints: list(40, text(1000)),
}) satisfies z.ZodType<ResumeProfile>;

export const questionsRequest = z.object({
  brief: z.object({
    position: text(200).min(1),
    description: text(4000).min(1),
    experience: z.number().min(0).max(80),
    techStack: text(1000).min(1),
  }),
  resume: resumeProfile.nullish(),
});

export const feedbackRequest = z.object({
  question: text(2000).min(1),
  modelAnswer: text(6000).min(1),
  // A ten-minute spoken answer is around 9,000 characters.
  userAnswer: text(20000).min(1),
});

export const resumeRequest = z.object({
  mimeType: z.enum(ACCEPTED_RESUME_TYPES),
  // base64 is 4/3 the size of the bytes it encodes.
  data: z.string().min(1).max(Math.ceil((MAX_RESUME_BYTES * 4) / 3) + 4),
});

/** Request and response for each worker route, keyed by its path. */
export interface AiTasks {
  questions: { request: z.input<typeof questionsRequest>; response: GeneratedQuestion[] };
  feedback: { request: z.input<typeof feedbackRequest>; response: AnswerFeedback };
  resume: { request: z.input<typeof resumeRequest>; response: ResumeProfile };
}

export type AiTask = keyof AiTasks;
