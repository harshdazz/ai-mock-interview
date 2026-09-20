import { generateStructured } from "./client";
import { feedbackSchema, questionsSchema } from "./schemas";
import { resumePromptSection, type ResumeProfile } from "./resume";

export interface GeneratedQuestion {
  question: string;
  answer: string;
}

export interface AnswerFeedback {
  rating: number;
  feedback: string;
}

export interface InterviewBrief {
  position: string;
  description: string;
  experience: number;
  techStack: string;
}

export async function generateQuestions(
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

For each question also write the model answer you would grade against. Make it concrete and specific enough that a vague response is visibly weaker than a good one.`;

  // With a CV attached the questions stop being about the stack in general and
  // start being about what this candidate says they did.
  const fullPrompt = resume ? prompt + resumePromptSection(resume) : prompt;

  return generateStructured<GeneratedQuestion[]>({
    prompt: fullPrompt,
    schema: questionsSchema,
    thinkingBudget: 0,
    signal,
  });
}

export async function generateFeedback(
  {
    question,
    modelAnswer,
    userAnswer,
  }: { question: string; modelAnswer: string; userAnswer: string },
  signal?: AbortSignal
): Promise<AnswerFeedback> {
  const prompt = `Grade this interview answer.

Question: ${question}

Model answer: ${modelAnswer}

Candidate's spoken answer: ${userAnswer}

The candidate's answer was transcribed from speech, so ignore punctuation, filler words and false starts. Grade the substance only.

Rate it 1 to 10. Then say what was missing and what to say instead, in two or three sentences addressed directly to the candidate. Be specific about the gap. Do not open with praise, do not soften the assessment, and do not restate the question.`;

  // A small thinking budget here: grading is a judgement call and benefits from
  // it, unlike question generation where it cost 8s and changed nothing.
  return generateStructured<AnswerFeedback>({
    prompt,
    schema: feedbackSchema,
    thinkingBudget: 256,
    signal,
  });
}
