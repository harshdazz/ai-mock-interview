import { useState } from "react";
import { FileText, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useResume } from "@/hooks/use-resume";
import { ResumeClaims, ResumeDropzone } from "./resume-upload";

/**
 * The CV panel on the dashboard. Uploaded once here, reused by every interview.
 *
 * It previously lived inside the create form, where the extracted claims were
 * shown for a moment and then thrown away the instant the form navigated off.
 */
export const ResumeCard = () => {
  const { resume, loading, save, clear } = useResume();
  const [replacing, setReplacing] = useState(false);

  if (loading) return <Skeleton className="h-32 rounded-lg" />;

  if (!resume || replacing) {
    return (
      <div className="flex flex-col gap-3">
        {replacing && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-ink-muted">Replacing your CV</span>
            <Button variant="ghost" size="sm" onClick={() => setReplacing(false)}>
              Cancel
            </Button>
          </div>
        )}
        <ResumeDropzone
          onExtracted={async (profile, fileName) => {
            await save(profile, fileName);
            setReplacing(false);
          }}
        />
      </div>
    );
  }

  const { profile, fileName } = resume;

  return (
    <section className="flex flex-col gap-3 rounded-lg border bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <FileText className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium">{fileName}</span>
            <span className="text-xs text-ink-muted">
              {profile.currentRole} · {profile.yearsExperience}{" "}
              {profile.yearsExperience === 1 ? "year" : "years"}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button variant="secondary" size="sm" onClick={() => setReplacing(true)}>
            Replace
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await clear();
              toast.success("CV removed", {
                description: "New interviews will use the role details only.",
              });
            }}
          >
            <X className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            Remove
          </Button>
        </div>
      </div>

      {profile.techStack.length > 0 && (
        <p className="text-pretty text-sm text-ink-muted">
          {profile.techStack.slice(0, 14).join(", ")}
        </p>
      )}

      <div className="border-t pt-3">
        <ResumeClaims profile={profile} />
      </div>
    </section>
  );
};
