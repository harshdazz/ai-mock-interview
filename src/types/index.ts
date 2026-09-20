import type { FieldValue, Timestamp } from "firebase/firestore";
import type { ResumeProfile } from "@/lib/ai/resume";

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
  questions: { question: string; answer: string }[];
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
  feedback: string;
  rating: number;
  userId: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}