import { db } from "@/config/firebase.config";
import { useAuth } from "@clerk/clerk-react";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { CustomBreadCrumb } from "@/components/custom-bread-crumb";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Mic } from "lucide-react";
import type { Interview, UserAnswer } from "@/types";
import LoaderPage from "./loader-page";
import Headings from "@/components/headings";
import InterviewPin from "@/components/pin";
import { ScoreDial } from "@/components/session/score-dial";

const bandText = (rating: number) =>
  rating >= 8 ? "text-success" : "text-warning";

export const Feedback = () => {
  const { interviewId } = useParams<{ interviewId: string }>();
  const [interview, setInterview] = useState<Interview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [feedbacks, setFeedbacks] = useState<UserAnswer[]>([]);
  const { userId } = useAuth();

  useEffect(() => {
    if (!interviewId || !userId) return;
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      try {
        const [interviewDoc, answersSnap] = await Promise.all([
          getDoc(doc(db, "interviews", interviewId)),
          getDocs(
            query(
              collection(db, "userAnswers"),
              where("userId", "==", userId),
              where("mockIdRef", "==", interviewId)
            )
          ),
        ]);
        if (cancelled) return;

        if (interviewDoc.exists()) {
          setInterview({ id: interviewDoc.id, ...interviewDoc.data() } as Interview);
        }
        setFeedbacks(
          answersSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as UserAnswer)
        );
      } catch (error) {
        if (cancelled) return;
        console.error("Failed to load feedback", error);
        toast.error("Could not load this feedback", {
          description: "Check your connection and refresh the page.",
        });
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [interviewId, userId]);

  const overall = useMemo(() => {
    if (feedbacks.length === 0) return null;
    const total = feedbacks.reduce((acc, f) => acc + (f.rating ?? 0), 0);
    return total / feedbacks.length;
  }, [feedbacks]);

  // Redirecting from the render body is a React anti-pattern; it warned and
  // could loop. Navigate does it declaratively instead.
  if (!interviewId) return <Navigate to="/generate" replace />;
  if (isLoading) return <LoaderPage className="h-[70vh] w-full" />;

  return (
    <div className="flex w-full flex-col gap-8 py-5">
      <CustomBreadCrumb
        breadCrumbPage="Feedback"
        breadCrumpItems={[
          { label: "Mock Interviews", link: "/generate" },
          {
            label: interview?.position ?? "Interview",
            link: `/generate/interview/${interviewId}`,
          },
        ]}
      />

      {feedbacks.length === 0 ? (
        <>
          <Headings
            title="No answers saved yet"
            description="Feedback appears here once you have answered and saved at least one question."
          />
          <div className="flex flex-col items-center gap-4 rounded-lg border bg-surface px-6 py-16 text-center">
            <span
              className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-2"
              aria-hidden="true"
            >
              <Mic className="h-5 w-5 text-ink-muted" />
            </span>
            <p className="max-w-[52ch] text-pretty text-sm text-ink-muted">
              Answer the questions out loud, then save each result. You can
              retake the interview as many times as you like.
            </p>
            <Button asChild className="mt-1">
              <Link to={`/generate/interview/${interviewId}`}>
                Start this interview
              </Link>
            </Button>
          </div>
        </>
      ) : (
        <>
          {/* Deliberately not "Congratulations". This page is read by someone
              who may have scored 2/10, and a score is a diagnosis, not a verdict
              on them. */}
          <Headings
            title="How that went"
            description="Each answer scored against the model answer, with what was missing and what to say instead."
          />

          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg border bg-surface px-5 py-4">
            <span className="text-sm text-ink-muted">
              Average across {feedbacks.length}{" "}
              {feedbacks.length === 1 ? "answer" : "answers"}
            </span>
            <span
              className={cn(
                "tabular text-2xl font-semibold",
                bandText(overall ?? 0)
              )}
            >
              {overall?.toFixed(1)}
            </span>
            <span className="tabular text-sm text-ink-faint">/ 10</span>
          </div>

          {interview && <InterviewPin interview={interview} onMockPage />}

          <Headings title="Answer by answer" isSubHeading description="" />

          <Accordion type="single" collapsible className="flex flex-col gap-3">
            {feedbacks.map((feed) => (
              <AccordionItem
                key={feed.id}
                value={feed.id}
                className="overflow-hidden rounded-lg border"
              >
                <AccordionTrigger className="gap-4 px-5 py-4 text-left text-[15px] font-medium hover:bg-surface hover:no-underline">
                  <span className="flex-1 text-pretty">{feed.question}</span>
                  <span
                    className={cn(
                      "tabular shrink-0 text-sm font-semibold",
                      bandText(feed.rating)
                    )}
                  >
                    {feed.rating}/10
                  </span>
                </AccordionTrigger>

                {/* Flat sections, not stacked cards. Cards inside an accordion
                    item inside a card is three nested containers saying nothing. */}
                <AccordionContent className="flex flex-col gap-6 border-t bg-surface px-5 py-6">
                  <ScoreDial
                    rating={feed.rating}
                    feedback={feed.feedback}
                    className="bg-background"
                  />

                  <section className="flex flex-col gap-2">
                    <h3 className="text-sm font-medium text-ink-muted">
                      What you said
                    </h3>
                    <p className="text-pretty text-[15px] leading-relaxed text-ink">
                      {feed.user_ans}
                    </p>
                  </section>

                  <section className="flex flex-col gap-2">
                    <h3 className="text-sm font-medium text-ink-muted">
                      A strong answer
                    </h3>
                    <p className="text-pretty text-[15px] leading-relaxed text-ink-muted">
                      {feed.correct_ans}
                    </p>
                  </section>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </>
      )}
    </div>
  );
};
