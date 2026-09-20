import { Type } from "@google/genai";
import type { Schema } from "@google/genai";

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
    },
    required: ["question", "answer"],
    propertyOrdering: ["question", "answer"],
  },
};

export const feedbackSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    rating: {
      type: Type.INTEGER,
      minimum: 1,
      maximum: 10,
      description: "Answer quality from 1 to 10.",
    },
    feedback: {
      type: Type.STRING,
      description:
        "What was missing and what to say instead. Addressed to the candidate, second person, no praise padding.",
    },
  },
  required: ["rating", "feedback"],
  propertyOrdering: ["rating", "feedback"],
};
