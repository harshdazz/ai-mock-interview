import type { Generate } from "./gemini.ts";
import { questionsSchema } from "./schemas.ts";
import { resumePromptSection, type ResumeProfile } from "./resume.ts";

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
  const prompt = `You are running a technical interview for the role below. Write five questions you would actually ask, in the order you would ask them, opening broader and getting more specific.

Role: ${brief.position}
Experience level: ${brief.experience} year(s)
Tech stack: ${brief.techStack}
Role description: ${brief.description}

Pitch the difficulty at ${brief.experience} years of experience: no trivia, no puzzles, nothing that only rewards memorisation. Favour questions about trade-offs and decisions the candidate would have faced in real work with ${brief.techStack}.

For each question also write the model answer you would grade against. Make it concrete and specific enough that a vague response is visibly weaker than a good one. Then pull 4 to 6 key points out of that model answer: the specific claims a strong answer has to make, each one checkable on its own against a transcript.`;

  // With a CV attached the questions stop being about the stack in general and
  // start being about what this candidate says they did.
  const fullPrompt = resume ? prompt + resumePromptSection(resume) : prompt;

  return generate<GeneratedQuestion[]>({
    parts: [{ text: fullPrompt }],
    schema: questionsSchema,
    thinkingBudget: 0,
    signal,
  });
}
