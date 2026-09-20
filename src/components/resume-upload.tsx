import { useRef, useState } from "react";
import { Loader, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AiError } from "@/lib/ai/client";
import {
  ACCEPTED_RESUME_TYPES,
  extractResume,
  validateResumeFile,
  type ResumeProfile,
} from "@/lib/ai/resume";
import { cn } from "@/lib/utils";

interface ResumeDropzoneProps {
  onExtracted: (profile: ResumeProfile, fileName: string) => void | Promise<void>;
  disabled?: boolean;
  compact?: boolean;
}

/** File picker plus extraction. Owns no persistence: the caller decides. */
export const ResumeDropzone = ({
  onExtracted,
  disabled,
  compact = false,
}: ResumeDropzoneProps) => {
  const [reading, setReading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    const invalid = validateResumeFile(file);
    if (invalid) {
      toast.error("Could not use that file", { description: invalid });
      return;
    }

    setReading(true);
    setFileName(file.name);
    try {
      const profile = await extractResume(file);
      await onExtracted(profile, file.name);
      toast.success("CV saved", {
        description: `Found ${profile.talkingPoints.length} things an interviewer could ask about.`,
      });
    } catch (error) {
      console.error("Failed to read CV", error);
      setFileName(null);
      toast.error(
        error instanceof AiError && error.kind === "rate_limited"
          ? "Daily API limit reached"
          : "Could not read that CV",
        {
          description:
            error instanceof AiError
              ? error.message
              : "Something went wrong reading the file. You can still create interviews without it.",
        }
      );
    } finally {
      setReading(false);
      // Allow re-selecting the same file after a failure.
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept={ACCEPTED_RESUME_TYPES.join(",")}
      className="sr-only"
      disabled={disabled || reading}
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) handleFile(file);
      }}
    />
  );

  if (compact) {
    return (
      <>
        {input}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={disabled || reading}
          onClick={() => inputRef.current?.click()}
        >
          {reading ? (
            <>
              <Loader className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              Reading
            </>
          ) : (
            "Choose a PDF"
          )}
        </Button>
      </>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled && !reading) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (disabled || reading) return;
        const file = e.dataTransfer.files?.[0];
        if (file) handleFile(file);
      }}
      className={cn(
        "flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-8 text-center transition-colors duration-200 ease-out",
        dragging ? "border-primary bg-primary/5" : "border-border-strong bg-surface"
      )}
    >
      {input}

      {reading ? (
        <>
          <Loader className="h-5 w-5 animate-spin text-ink-muted" aria-hidden="true" />
          <p className="text-sm text-ink-muted" role="status">
            Reading {fileName}. This takes a few seconds.
          </p>
        </>
      ) : (
        <>
          <Upload className="h-5 w-5 text-ink-muted" aria-hidden="true" />
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">Add your CV</p>
            <p className="max-w-[48ch] text-pretty text-sm text-ink-muted">
              Upload it once and every interview you create will be built around
              what you actually did, so you have to defend your own work instead
              of answering in the abstract.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
          >
            Choose a PDF
          </Button>
          <p className="text-xs text-ink-faint">PDF, up to 5MB</p>
        </>
      )}
    </div>
  );
};

/** The claims a set of questions will be, or was, grounded in. */
export const ResumeClaims = ({
  profile,
  limit = 4,
  label = "Questions will dig into",
}: {
  profile: ResumeProfile;
  limit?: number;
  label?: string;
}) => {
  if (profile.talkingPoints.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-ink-muted">{label}</span>
      <ul className="flex list-disc flex-col gap-1 pl-4">
        {profile.talkingPoints.slice(0, limit).map((point) => (
          <li key={point} className="text-pretty text-sm text-ink-muted">
            {point}
          </li>
        ))}
      </ul>
    </div>
  );
};
