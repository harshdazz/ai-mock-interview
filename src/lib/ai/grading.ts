import type { Generate } from "./gemini.ts";
import { gradingSchema, keyPointsSchema } from "./schemas.ts";
import { alignVerdicts, scoreFromPoints, type AnswerGrade, type RawVerdict } from "./scoring.ts";

/**
 * Grading against criteria, not a guessed number.
 *
 * The old prompt asked the model to "rate it 1 to 10", which made the score a
 * single opaque judgement: the same answer could come back 5 one run and 7 the
 * next, with nothing to say why. Here every question carries 4 to 6 key
 * points fixed when the question is written. The model only answers one small
 * question per point (did the candidate make it, and where?), and the score is
 * plain arithmetic over those answers, in scoring.ts. A score is therefore
 * always explainable as "you made these points and missed these".
 *
 * No React and no browser APIs in this file: the worker, `pnpm eval` and any
 * outside test harness call `gradeAnswer` directly with their own `generate`.
 */

export interface GradeInput {
  question: string;
  modelAnswer: string;
  /** Absent on questions generated before key points existed. */
  keyPoints?: string[];
  /** The candidate's answer, usually a speech-to-text transcript. */
  answer: string;
}

interface RawGrade {
  points: RawVerdict[];
  advice: string;
}

const numbered = (items: string[]) => items.map((item, i) => `${i + 1}. ${item}`).join("\n");

/** Key points for a question that was generated before they existed. */
export async function deriveKeyPoints(
  generate: Generate,
  { question, modelAnswer }: Pick<GradeInput, "question" | "modelAnswer">,
  signal?: AbortSignal
): Promise<string[]> {
  const { keyPoints } = await generate<{ keyPoints: string[] }>({
    parts: [
      {
        text: `List the key points a strong answer to this interview question makes, taken from the model answer.

Question: ${question}

Model answer: ${modelAnswer}`,
      },
    ],
    schema: keyPointsSchema,
    thinkingBudget: 0,
    signal,
  });
  return keyPoints;
}

export async function gradeAnswer(
  generate: Generate,
  input: GradeInput,
  signal?: AbortSignal
): Promise<AnswerGrade> {
  const keyPoints = input.keyPoints?.length
    ? input.keyPoints
    : await deriveKeyPoints(generate, input, signal);

  const prompt = `Grade this interview answer against a fixed list of key points.

Question: ${input.question}

Model answer, for context: ${input.modelAnswer}

Key points:
${numbered(keyPoints)}

Candidate's spoken answer: ${input.answer}

The answer was transcribed from speech, so ignore punctuation, filler words and false starts.

Return one entry per key point, using its number as the id:
- quote: copy the candidate's words that make the point, exactly as they appear in the answer. Leave it empty if nothing they said makes it.
- verdict: "covered" if the answer makes the point in substance, even informally or in other words. "missed" if it is absent, only gestured at with a buzzword, or wrong.

Judge each point on its own. A strong answer elsewhere earns nothing for a point it did not make.

Then the advice: what to say instead. Write one or two sentences in the candidate's own first person that they could say out loud next time to cover the most important missed point, specific to what they were describing. The missed points are already listed for them, so do not list them again, and do not open with praise. If nothing was missed, write a sharper version of their strongest point.`;

  // Thinking stays on at a small budget: deciding whether a point was made is
  // a judgement call, unlike question generation. Temperature is left at the
  // default, which Google advises for Gemini 3 models; consistency comes from
  // the fixed criteria and the arithmetic, not from sampling.
  const raw = await generate<RawGrade>({
    parts: [{ text: prompt }],
    schema: gradingSchema(keyPoints.length),
    thinkingBudget: 256,
    signal,
  });

  const points = alignVerdicts(keyPoints, raw.points);
  return { ...scoreFromPoints(points), points, advice: raw.advice.trim() };
}
