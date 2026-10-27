/**
 * The arithmetic half of grading: no model, no SDK, no imports. Kept apart
 * from grading.ts so the browser can use it without pulling @google/genai
 * into the bundle, and so it is trivially testable.
 */

export interface KeyPointResult {
  point: string;
  covered: boolean;
  /** The candidate's words that made the point. Empty when missed. */
  quote: string;
}

export interface AnswerGrade {
  /** 0 to 10, computed from `points` by {@link scoreFromPoints}. */
  score: number;
  covered: number;
  total: number;
  points: KeyPointResult[];
  /** What to say instead, written by the model about the missed points. */
  advice: string;
}

/** One entry of the model's structured output, before any checking. */
export interface RawVerdict {
  id: number;
  quote: string;
  verdict: "covered" | "missed";
}

/** Equal weight per point, so the score reads directly as coverage. */
export function scoreFromPoints(
  points: KeyPointResult[]
): Pick<AnswerGrade, "score" | "covered" | "total"> {
  const total = points.length;
  const covered = points.filter((p) => p.covered).length;
  return { score: total === 0 ? 0 : Math.round((covered / total) * 10), covered, total };
}

/**
 * Lines the model's verdicts up with the key points by id. A point the model
 * skipped, or marked covered without quoting anything, counts as missed: a
 * claim with no evidence is not one the feedback can stand behind.
 */
export function alignVerdicts(keyPoints: string[], verdicts: RawVerdict[]): KeyPointResult[] {
  return keyPoints.map((point, i) => {
    const verdict = verdicts.find((v) => v.id === i + 1);
    const quote = verdict?.quote.trim() ?? "";
    const covered = verdict?.verdict === "covered" && quote.length > 0;
    return { point, covered, quote: covered ? quote : "" };
  });
}

/** One line for storage and for anywhere the checklist cannot be shown. */
export function describeGrade(grade: AnswerGrade): string {
  const missed = grade.points.filter((p) => !p.covered).map((p) => p.point);
  const gap = missed.length > 0 ? `Missed: ${missed.join("; ")}.` : "You covered every key point.";
  return grade.advice ? `${gap} What to say instead: ${grade.advice}` : gap;
}
