import { cn } from "@/lib/utils";

/**
 * What the speech recogniser has heard so far.
 *
 * Settled text and in-flight text are distinguished by weight and opacity
 * rather than colour, so the distinction survives a colour-blind reader and a
 * greyscale screenshot.
 */
export const LiveTranscript = ({
  finalText,
  interimText,
  isRecording,
  minChars,
  className,
}: {
  finalText: string;
  interimText?: string;
  isRecording: boolean;
  minChars: number;
  className?: string;
}) => {
  const count = finalText.trim().length;
  const tooShort = count > 0 && count < minChars;
  const empty = count === 0 && !interimText;

  return (
    <section
      className={cn("flex flex-col gap-3", className)}
      aria-label="Your answer transcript"
    >
      <header className="flex items-baseline justify-between gap-4">
        <h2 className="text-sm font-medium text-ink-muted">Your answer</h2>
        {count > 0 && (
          <span
            className={cn("tabular text-xs", tooShort ? "text-warning" : "text-ink-faint")}
          >
            {count} characters
            {tooShort && ` · ${minChars} needed`}
          </span>
        )}
      </header>

      <div
        className="min-h-28 rounded-lg border bg-surface p-4 text-[15px] leading-relaxed"
        aria-live="polite"
        aria-atomic="false"
      >
        {empty ? (
          <p className="text-ink-faint">
            {isRecording
              ? "Listening. Start speaking and your words will appear here."
              : "Press record, then answer out loud as you would in the room."}
          </p>
        ) : (
          <p className="text-pretty text-ink">
            {finalText}
            {interimText && (
              <span className="font-light italic text-ink-faint"> {interimText}</span>
            )}
          </p>
        )}
      </div>
    </section>
  );
};
