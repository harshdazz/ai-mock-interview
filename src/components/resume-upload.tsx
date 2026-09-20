import { useRef, useState } from "react";
import { FileText, Loader, Upload, X } from "lucide-react";
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

interface ResumeUploadProps {
  value: ResumeProfile | null;
  onChange: (profile: ResumeProfile | null) => void;
  disabled?: boolean;
}

export const ResumeUpload = ({ value, onChange, disabled }: ResumeUploadProps) => {
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
      onChange(profile);
      toast.success("CV read", {
        description: `Found ${profile.talkingPoints.length} things an interviewer could ask about.`,
      });
    } catch (error) {
      console.error("Failed to read CV", error);
      onChange(null);
      setFileName(null);
      toast.error(
        error instanceof AiError && error.kind === "rate_limited"
          ? "Daily API limit reached"
          : "Could not read that CV", {
        description:
          error instanceof AiError
            ? error.message
            : "Something went wrong reading the file. You can create the interview without it.",
      });
    } finally {
      setReading(false);
      // Allow re-selecting the same file after a failure.
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const clear = () => {
    onChange(null);
    setFileName(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  if (value) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border bg-surface p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <FileText className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
            <span className="truncate text-sm font-medium">
              {fileName ?? "Your CV"}
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clear}
            disabled={disabled}
          >
            <X className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            Remove
          </Button>
        </div>

        <p className="text-sm text-ink-muted">
          {value.currentRole} · {value.yearsExperience}{" "}
          {value.yearsExperience === 1 ? "year" : "years"}
        </p>

        {value.techStack.length > 0 && (
          <p className="text-pretty text-sm text-ink-muted">
            {value.techStack.slice(0, 12).join(", ")}
          </p>
        )}

        {/* Showing the extracted claims is the point: the user can see exactly
            what the questions will be built from before generating them. */}
        {value.talkingPoints.length > 0 && (
          <div className="flex flex-col gap-1.5 border-t pt-3">
            <span className="text-xs font-medium text-ink-muted">
              Questions will dig into
            </span>
            <ul className="flex list-disc flex-col gap-1 pl-4">
              {value.talkingPoints.slice(0, 4).map((point) => (
                <li key={point} className="text-pretty text-sm text-ink-muted">
                  {point}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
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
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_RESUME_TYPES.join(",")}
        className="sr-only"
        id="resume-upload"
        disabled={disabled || reading}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />

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
            <p className="text-sm font-medium">Add your CV (optional)</p>
            <p className="max-w-[46ch] text-pretty text-sm text-ink-muted">
              Questions will be built around what you actually did, so you have
              to defend your own work instead of answering in the abstract.
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
