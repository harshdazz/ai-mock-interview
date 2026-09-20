import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const format = (totalSeconds: number) => {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
};

/**
 * Recording state, the way a studio shows it.
 *
 * State is never carried by colour alone: the dot is paired with a text label
 * and a running timer, so it reads for colour-blind users and in screenshots.
 * The pulse is the only looping animation in the product, and the global
 * prefers-reduced-motion rule flattens it to a static dot.
 */
export const TallyLight = ({
  isRecording,
  className,
}: {
  isRecording: boolean;
  className?: string;
}) => {
  const [seconds, setSeconds] = useState(0);
  const startedAt = useRef<number | null>(null);

  useEffect(() => {
    if (!isRecording) {
      startedAt.current = null;
      setSeconds(0);
      return;
    }
    startedAt.current = Date.now();
    setSeconds(0);
    const id = setInterval(() => {
      if (startedAt.current) {
        setSeconds(Math.floor((Date.now() - startedAt.current) / 1000));
      }
    }, 250);
    return () => clearInterval(id);
  }, [isRecording]);

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2.5 rounded-full border px-3 py-1.5",
        isRecording ? "border-live/40 bg-live/10" : "border-border bg-surface-2",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <span
        aria-hidden="true"
        className={cn(
          "h-2.5 w-2.5 shrink-0 rounded-full",
          isRecording ? "animate-tally bg-live" : "bg-ink-faint"
        )}
      />
      <span
        className={cn(
          "text-sm font-medium",
          isRecording ? "text-ink" : "text-ink-muted"
        )}
      >
        {isRecording ? "Recording" : "Not recording"}
      </span>
      {isRecording && (
        <span className="tabular text-sm text-ink-muted">{format(seconds)}</span>
      )}
    </div>
  );
};
