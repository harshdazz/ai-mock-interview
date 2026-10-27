import type { Generate } from "./gemini.ts";
import { questionsSchema } from "./schemas.ts";
import { describeResume, type ResumeProfile } from "./resume.ts";
import { createFence } from "./untrusted.ts";

export interface GeneratedQuestion {
  question: string;
  answer: string;
  /** What the answer is graded against. See grading.ts. */
  keyPoints: string[];
}

export interface InterviewBrief {
  position: string;
  description: string;
  experience: number;
  techStack: string;
}

export async function generateQuestions(
  generate: Generate,
  brief: InterviewBrief,
  resume?: ResumeProfile | null,
  signal?: AbortSignal
): Promise<GeneratedQuestion[]> {
  // The brief is typed in by the user and the CV is a document they uploaded,
  // so both are fenced data. `experience` is a number the worker has already
  // validated, so it is safe to use in the instructions.
  const role = `Role: ${brief.position}
Tech stack: ${brief.techStack}
Role description: ${brief.description}`;
  const cv = resume ? describeResume(resume) : null;
  const fence = createFence(cv ? [role, cv] : [role]);

  // With a CV attached the questions stop being about the stack in general and
  // start being about what this candidate says they did.
  const cvInstruction = cv
    ? `

<${fence.tag("cv")}> holds what the candidate's CV says. Ground at least three of the five questions in specific things they claim there, naming the project or result so they have to defend their own work rather than answer in the abstract. Do not ask about anything that is not evidenced in it.`
    : "";

  const system = `You are running a technical interview for the role described in <${fence.tag("role")}>. Write five questions you would actually ask, in the order you would ask them, opening broader and getting more specific.

Pitch the difficulty at ${brief.experience} year(s) of experience: no trivia, no puzzles, nothing that only rewards memorisation. Favour questions about trade-offs and decisions the candidate would have faced in real work with that tech stack.

For each question also write the model answer you would grade against. Make it concrete and specific enough that a vague response is visibly weaker than a good one. Then pull 4 to 6 key points out of that model answer: the specific claims a strong answer has to make, each one checkable on its own against a transcript.${cvInstruction}

${fence.rule}`;

  return generate<GeneratedQuestion[]>({
    system,
    parts: [{ text: cv ? `${fence.wrap("role", role)}\n\n${fence.wrap("cv", cv)}` : fence.wrap("role", role) }],
    schema: questionsSchema,
    thinkingBudget: 0,
    signal,
  });
}
