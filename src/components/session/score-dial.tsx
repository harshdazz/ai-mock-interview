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
 */
export const ScoreDial = ({
  rating,
  feedback,
  className,
}: {
  rating: number;
  feedback: string;
  className?: string;
}) => {
  const clamped = Math.min(10, Math.max(1, Math.round(rating)));
  const band = bandOf(clamped);

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

      <p className="text-pretty text-[15px] leading-relaxed text-ink-muted">
        {feedback}
      </p>
    </section>
  );
};
