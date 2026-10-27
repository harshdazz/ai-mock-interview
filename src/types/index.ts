import type { FieldValue, Timestamp } from "firebase/firestore";
import type { KeyPointResult } from "@/lib/ai/scoring";
import type { ResumeProfile } from "@/lib/ai/resume";

export interface InterviewQuestion {
  question: string;
  answer: string;
  /** What answers are graded against. Absent on interviews generated before
   *  criteria scoring, in which case the worker derives them per grade. */
  keyPoints?: string[];
}

export interface User {
    id: string;
    name: string;
    email: string;
    imageUrl: string;
    createdAt: Timestamp | FieldValue
    updatedAt: Timestamp | FieldValue
    /** The CV belongs to the person, so it is stored here and reused by every
     *  interview they create. Each interview keeps its own snapshot. */
    resume?: ResumeProfile | null
    resumeFileName?: string | null
    resumeUpdatedAt?: Timestamp | FieldValue
}

export interface Interview {
  id: string;
  position: string;
  description: string;
  experience: number;
  userId: string;
  techStack: string;
  questions: InterviewQuestion[];
  /** Set when the interview was generated from an uploaded CV. */
  resume?: ResumeProfile | null;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export interface UserAnswer {
  id: string;
  mockIdRef: string;
  question: string;
  correct_ans: string;
  user_ans: string;
  /** A one-line summary naming the missed points. */
  feedback: string;
  /** 0 to 10, computed from `criteria`. Older answers hold a 1-10 model guess. */
  rating: number;
  /** Per-key-point result. Absent on answers graded before criteria scoring. */
  criteria?: KeyPointResult[];
  advice?: string;
  /** The interviewer's follow-up, when there was one. `rating` then counts
   *  both answers; `scoreBefore` is the main answer alone. An empty `answer`
   *  means it was skipped. */
  followUp?: { question: string; answer: string; scoreBefore: number };
  userId: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}