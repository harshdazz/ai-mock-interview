import { Check, CircleDashed } from "lucide-react";
import type { KeyPointResult } from "@/lib/ai/scoring";
import { cn } from "@/lib/utils";

type Band = "weak" | "mixed" | "strong";

const bandOf = (rating: number): Band =>
  rating >= 8 ? "strong" : rating >= 5 ? "mixed" : "weak";

const BAND_LABEL: Record<Band, string> = {
  strong: "Strong answer",
  mixed: "Partly there",
  weak: "Needs work",
};

// Amber for a weak score, never red. Red is the recording state; a low score
// is a diagnosis, not an alarm.
const BAND_FILL: Record<Band, string> = {
  strong: "bg-success",
  mixed: "bg-warning",
  weak: "bg-warning",
};

const BAND_TEXT: Record<Band, string> = {
  strong: "text-success",
  mixed: "text-warning",
  weak: "text-warning",
};

/**
 * A rating and the reason for it, in one component.
 *
 * There is deliberately no way to render the number on its own: the score is
 * only useful attached to what to do about it, and a bare number out of context
 * reads as a verdict on the person.
 *
 * With `points`, the score is the share of key points covered, so the gap is
 * shown as the exact points that were missed, ahead of everything else. Each
 * covered point quotes the candidate's own words back, which is what makes the
 * credit checkable. Answers graded before key points existed only have
 * `feedback`, and render as they always did.
 */
export const ScoreDial = ({
  rating,
  feedback,
  points,
  className,
}: {
  rating: number;
  /** The advice for criteria grades; the whole diagnosis for older ones. */
  feedback: string;
  points?: KeyPointResult[];
  className?: string;
}) => {
  const clamped = Math.min(10, Math.max(0, Math.round(rating)));
  const band = bandOf(clamped);
  const missed = points?.filter((p) => !p.covered) ?? [];
  const covered = points?.filter((p) => p.covered) ?? [];

  return (
    <section
      className={cn("flex flex-col gap-4 rounded-lg border bg-surface p-5", className)}
      aria-label={`Feedback, rated ${clamped} out of 10`}
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <span className={cn("tabular text-3xl font-semibold", BAND_TEXT[band])}>
            {clamped}
          </span>
          <span className="tabular text-sm text-ink-faint">/ 10</span>
          {points && (
            <span className="tabular ml-2 text-sm text-ink-muted">
              {covered.length} of {points.length} key points
            </span>
          )}
        </div>
        <span className={cn("text-sm font-medium", BAND_TEXT[band])}>
          {BAND_LABEL[band]}
        </span>
      </header>

      <div
        className="flex gap-1"
        role="img"
        aria-label={`${clamped} out of 10`}
      >
        {Array.from({ length: 10 }, (_, i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors duration-300 ease-out",
              i < clamped ? BAND_FILL[band] : "bg-surface-2"
            )}
          />
        ))}
      </div>

      {missed.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-ink">What was missing</h3>
          <ul className="flex flex-col gap-2">
            {missed.map((p) => (
              <li key={p.point} className="flex gap-2.5 text-pretty text-[15px] leading-relaxed text-ink">
                <CircleDashed className="mt-1 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
                {p.point}
              </li>
            ))}
          </ul>
        </div>
      )}

      {feedback && points ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-ink">What to say instead</h3>
          <p className="text-pretty text-[15px] leading-relaxed text-ink-muted">{feedback}</p>
        </div>
      ) : (
        feedback && (
          <p className="text-pretty text-[15px] leading-relaxed text-ink-muted">
            {feedback}
          </p>
        )
      )}

      {covered.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-ink-muted">What you covered</h3>
          <ul className="flex flex-col gap-3">
            {covered.map((p) => (
              <li key={p.point} className="flex gap-2.5">
                <Check className="mt-1 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                <div className="flex flex-col gap-0.5">
                  <span className="text-pretty text-[15px] leading-relaxed text-ink-muted">
                    {p.point}
                  </span>
                  <q className="text-pretty text-sm text-ink-faint">{p.quote}</q>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};
