// Server-side: these describe what Gemini must return, so only code that calls
// Gemini imports them.
import { Type } from "@google/genai";
import type { Schema } from "@google/genai";

const keyPoints: Schema = {
  type: Type.ARRAY,
  minItems: "4",
  maxItems: "6",
  items: { type: Type.STRING },
  description:
    "4 to 6 key points taken from the model answer. Each is one concrete claim a strong answer makes, in under 15 words, specific enough that someone reading a transcript can say whether it was made. No two points overlap.",
};

export const questionsSchema: Schema = {
  type: Type.ARRAY,
  minItems: "5",
  maxItems: "5",
  items: {
    type: Type.OBJECT,
    properties: {
      question: {
        type: Type.STRING,
        description: "The interview question, asked as an interviewer would speak it.",
      },
      answer: {
        type: Type.STRING,
        description:
          "A strong model answer, specific enough to grade against. No preamble.",
      },
      keyPoints,
    },
    required: ["question", "answer", "keyPoints"],
    // The answer comes first so the key points are drawn from it, not the
    // other way round.
    propertyOrdering: ["question", "answer", "keyPoints"],
  },
};

/** For questions generated before key points existed. */
export const keyPointsSchema: Schema = {
  type: Type.OBJECT,
  properties: { keyPoints },
  required: ["keyPoints"],
};

/**
 * One verdict per key point, in the order given. The array length is fixed to
 * the number of key points, so the model cannot skip one or add its own.
 *
 * `quote` comes before `verdict` on purpose: the model has to find the
 * evidence in the transcript before it decides, rather than deciding and then
 * looking for something to justify it. Code then checks every quote against
 * the transcript (quotes.ts), so the evidence cannot be invented either.
 */
const verdicts = (pointCount: number): Schema => ({
  type: Type.ARRAY,
  minItems: String(pointCount),
  maxItems: String(pointCount),
  items: {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.INTEGER, description: "The key point's number." },
      quote: {
        type: Type.STRING,
        description:
          "One contiguous passage of at least three of the candidate's words that makes this point, copied exactly from the transcript, at most 30 words. Empty if nothing they said makes it.",
      },
      verdict: { type: Type.STRING, format: "enum", enum: ["covered", "missed"] },
    },
    required: ["id", "quote", "verdict"],
    propertyOrdering: ["id", "quote", "verdict"],
  },
});

export const gradingSchema = (pointCount: number): Schema => ({
  type: Type.OBJECT,
  properties: {
    points: verdicts(pointCount),
    advice: {
      type: Type.STRING,
      description:
        "One or two sentences, in the candidate's first person, that they could say out loud next time to cover the most important missed point. Not a restatement of the missed points, which are shown separately. No praise.",
    },
  },
  required: ["points", "advice"],
  propertyOrdering: ["points", "advice"],
});

/**
 * One yes/no per (key point, quote) pair: do these words make this point?
 * The short reason comes first so the answer follows from it.
 */
export const supportSchema = (pairCount: number): Schema => ({
  type: Type.OBJECT,
  properties: {
    checks: {
      type: Type.ARRAY,
      minItems: String(pairCount),
      maxItems: String(pairCount),
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.INTEGER },
          reason: { type: Type.STRING, description: "At most 15 words." },
          supports: { type: Type.BOOLEAN },
        },
        required: ["id", "reason", "supports"],
        propertyOrdering: ["id", "reason", "supports"],
      },
    },
  },
  required: ["checks"],
});

/**
 * Did the answer back up what the CV claims? The claim is identified first,
 * then the evidence, then the verdict, so each step builds on the last.
 */
export const cvCheckSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    claim: {
      type: Type.STRING,
      description:
        "The one CV claim this question is about, copied from the CV. Empty if the question is not about anything in the CV.",
    },
    quote: {
      type: Type.STRING,
      description:
        "One contiguous passage of at least three of the candidate's words that backs the claim, copied exactly. Empty if none.",
    },
    verdict: {
      type: Type.STRING,
      format: "enum",
      enum: ["backed", "partly", "not_backed", "not_applicable"],
    },
    gap: {
      type: Type.STRING,
      description:
        "Under 15 words: what about the claim is still unproven. Empty when backed or not applicable.",
    },
  },
  required: ["claim", "quote", "verdict", "gap"],
  propertyOrdering: ["claim", "quote", "verdict", "gap"],
};

/** The interviewer's one follow-up. The gap is chosen before the question is written. */
export const followUpSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    target: { type: Type.STRING, description: "The gap being probed, copied from the list." },
    reason: { type: Type.STRING, format: "enum", enum: ["missed_point", "cv_claim"] },
    question: {
      type: Type.STRING,
      description: "One question, as an interviewer would say it, under 30 words.",
    },
  },
  required: ["target", "reason", "question"],
  propertyOrdering: ["target", "reason", "question"],
};

/** The second look at points whose quotes were not found. No advice needed. */
export const verdictsSchema = (pointCount: number): Schema => ({
  type: Type.OBJECT,
  properties: { points: verdicts(pointCount) },
  required: ["points"],
});
