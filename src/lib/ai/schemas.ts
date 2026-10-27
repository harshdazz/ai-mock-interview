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
 * looking for something to justify it.
 */
export const gradingSchema = (pointCount: number): Schema => ({
  type: Type.OBJECT,
  properties: {
    points: {
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
              "The candidate's own words that make this point, copied exactly from the transcript, at most 25 words. Empty if nothing they said makes it.",
          },
          verdict: { type: Type.STRING, format: "enum", enum: ["covered", "missed"] },
        },
        required: ["id", "quote", "verdict"],
        propertyOrdering: ["id", "quote", "verdict"],
      },
    },
    advice: {
      type: Type.STRING,
      description:
        "One or two sentences, in the candidate's first person, that they could say out loud next time to cover the most important missed point. Not a restatement of the missed points, which are shown separately. No praise.",
    },
  },
  required: ["points", "advice"],
  propertyOrdering: ["points", "advice"],
});
