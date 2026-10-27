import { z } from "zod";
import type { AssessInput, Assessment } from "./followup.ts";
import type { GradeInput } from "./grading.ts";
import type { AnswerGrade } from "./scoring.ts";
import type { GeneratedQuestion } from "./interview.ts";
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

export const gradeRequest = z.object({
  question: text(2000).min(1),
  modelAnswer: text(6000).min(1),
  // Optional: interviews generated before key points existed have none, and
  // the worker derives them.
  keyPoints: list(8, text(300).min(1)).optional(),
  // A ten-minute spoken answer is around 9,000 characters.
  answer: text(20000).min(1),
}) satisfies z.ZodType<GradeInput>;

/** A main answer: grade it, check the CV claim, and decide the follow-up. */
export const assessRequest = gradeRequest.extend({
  resume: resumeProfile.nullish(),
}) satisfies z.ZodType<AssessInput>;

export const resumeRequest = z.object({
  mimeType: z.enum(ACCEPTED_RESUME_TYPES),
  // base64 is 4/3 the size of the bytes it encodes.
  data: z.string().min(1).max(Math.ceil((MAX_RESUME_BYTES * 4) / 3) + 4),
});

/** Request and response for each worker route, keyed by its path. */
export interface AiTasks {
  questions: { request: z.input<typeof questionsRequest>; response: GeneratedQuestion[] };
  /** The follow-up answer: graded together with the main one, no new follow-up. */
  grade: { request: z.input<typeof gradeRequest>; response: AnswerGrade };
  assess: { request: z.input<typeof assessRequest>; response: Assessment };
  resume: { request: z.input<typeof resumeRequest>; response: ResumeProfile };
}

export type AiTask = keyof AiTasks;
