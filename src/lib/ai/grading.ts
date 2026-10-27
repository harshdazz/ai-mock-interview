import type { Generate } from "./gemini.ts";
import { findQuote } from "./quotes.ts";
import { gradingSchema, keyPointsSchema, verdictsSchema } from "./schemas.ts";
import {
  alignVerdicts,
  scoreFromPoints,
  type AnswerGrade,
  type KeyPointResult,
  type RawVerdict,
} from "./scoring.ts";

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

const QUOTE_RULE = `copy one contiguous passage of at least three of the candidate's words, exactly as they appear in the answer. Keep their wording even where it is ungrammatical: do not paraphrase, tidy it up, or join separate passages`;

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
- quote: ${QUOTE_RULE}. Leave it empty if nothing they said makes the point.
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
  const verification = await verifyQuotes(generate, input, points, signal);
  return { ...scoreFromPoints(points), points, advice: raw.advice.trim(), verification };
}

/**
 * Every "covered" claim must be backed by words the candidate actually said.
 *
 * Each quote is looked up in the transcript. A quote that is there is replaced
 * with the transcript's own wording, so what the candidate sees is what they
 * said, not the model's tidied version. Claims whose quote is not there get
 * one more look, all in a single call: either a real quote or "missed". A
 * claim that still has no real quote is dropped, i.e. counted as missed.
 *
 * Mutates `points`; returns what happened, for the eval and the logs.
 */
async function verifyQuotes(
  generate: Generate,
  input: GradeInput,
  points: KeyPointResult[],
  signal?: AbortSignal
): Promise<AnswerGrade["verification"]> {
  const unbacked: number[] = [];
  points.forEach((point, i) => {
    if (!point.covered) return;
    const found = findQuote(point.quote, input.answer);
    if (found) point.quote = found;
    else unbacked.push(i);
  });
  if (unbacked.length === 0) return { retried: 0, dropped: 0 };

  const recheck = unbacked
    .map((i) => `${i + 1}. ${points[i].point}\n   Quote given: "${points[i].quote}"`)
    .join("\n");

  let second: RawVerdict[] = [];
  try {
    ({ points: second } = await generate<{ points: RawVerdict[] }>({
      parts: [
        {
          text: `You are re-checking part of an interview grade. The earlier grade said the candidate made the key points below, but the quotes it gave are not in the candidate's answer.

Question: ${input.question}

Key points to re-check:
${recheck}

Candidate's spoken answer: ${input.answer}

For each point, using its number as the id: if the candidate really made it, ${QUOTE_RULE}, and mark it covered. If they did not make it, mark it missed and leave the quote empty.`,
        },
      ],
      schema: verdictsSchema(unbacked.length),
      thinkingBudget: 256,
      signal,
    }));
  } catch (error) {
    // Without the second look the claims stay unbacked, and unbacked claims
    // are dropped. A grade that is too strict beats one that invents credit.
    if (signal?.aborted) throw error;
  }

  let dropped = 0;
  for (const i of unbacked) {
    const verdict = second.find((v) => v.id === i + 1);
    const found = verdict?.verdict === "covered" ? findQuote(verdict.quote, input.answer) : null;
    if (found) {
      points[i].quote = found;
    } else {
      points[i] = { ...points[i], covered: false, quote: "" };
      dropped++;
    }
  }
  return { retried: unbacked.length, dropped };
}
