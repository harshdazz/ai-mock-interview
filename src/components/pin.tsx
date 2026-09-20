import type { Interview } from "@/types";
import { useNavigate } from "react-router-dom";
import { Card, CardDescription, CardFooter, CardTitle } from "@/components/ui/card";
import { Badge } from "./ui/badge";
import { cn } from "@/lib/utils";
import { TooltipButton } from "./tooltip-button";
import { Eye, Newspaper, Sparkles } from "lucide-react";

interface InterviewPinProps {
  interview: Interview;
  onMockPage?: boolean;
}

/**
 * Firestore fires onSnapshot for a local write before the server resolves
 * serverTimestamp(), so createdAt is briefly null on a just-created interview.
 * Calling .toDate() on it threw and took the whole dashboard down.
 */
const formatCreatedAt = (createdAt: Interview["createdAt"]) => {
  const date = createdAt?.toDate?.();
  if (!date) return "Just now";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const InterviewPin = ({ interview, onMockPage = false }: InterviewPinProps) => {
  const navigate = useNavigate();

  const techStack = interview.techStack
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return (
    <Card className="flex h-full flex-col gap-4 rounded-lg p-5 shadow-none transition-shadow duration-200 ease-out hover:shadow-md">
      <div className="flex flex-col gap-1.5">
        <CardTitle className="text-balance text-base font-semibold leading-snug">
          {interview.position}
        </CardTitle>
        <CardDescription className="line-clamp-2 text-pretty">
          {interview.description}
        </CardDescription>
      </div>

      {techStack.length > 0 && (
        <ul className="flex flex-wrap items-center gap-1.5">
          {techStack.map((item) => (
            <li key={item}>
              <Badge variant="outline" className="font-normal text-ink-muted">
                {item}
              </Badge>
            </li>
          ))}
        </ul>
      )}

      <CardFooter
        className={cn(
          "mt-auto flex w-full items-center gap-2 p-0",
          onMockPage ? "justify-end" : "justify-between"
        )}
      >
        <p className="tabular truncate text-xs text-ink-faint">
          {formatCreatedAt(interview.createdAt)}
        </p>

        {!onMockPage && (
          <div className="flex shrink-0 items-center">
            {/* No replace: true here. It wiped the dashboard from history, so
                the browser back button skipped past it. */}
            <TooltipButton
              content="Edit this interview"
              buttonVariant="ghost"
              onClick={() => navigate(`/generate/${interview.id}`)}
              buttonClassName="hover:text-ink"
              icon={<Eye className="h-4 w-4" />}
            />
            <TooltipButton
              content="Review past feedback"
              buttonVariant="ghost"
              onClick={() => navigate(`/generate/feedback/${interview.id}`)}
              buttonClassName="hover:text-ink"
              icon={<Newspaper className="h-4 w-4" />}
            />
            <TooltipButton
              content="Start this interview"
              buttonVariant="ghost"
              onClick={() => navigate(`/generate/interview/${interview.id}`)}
              buttonClassName="hover:text-primary"
              icon={<Sparkles className="h-4 w-4" />}
            />
          </div>
        )}
      </CardFooter>
    </Card>
  );
};

export default InterviewPin;
