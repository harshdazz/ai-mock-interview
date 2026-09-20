import Headings from "@/components/headings";
import InterviewPin from "@/components/pin";
import { ResumeCard } from "@/components/resume-card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { db } from "@/config/firebase.config";
import type { Interview } from "@/types";
import { useAuth } from "@clerk/clerk-react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { Mic, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

const Dashboard = () => {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  // Starts true: starting false rendered the "nothing here" state for a beat
  // before the first snapshot arrived, so a returning user saw an empty
  // dashboard flash before their own interviews appeared.
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const { userId } = useAuth();

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    setFailed(false);

    const interviewQuery = query(
      collection(db, "interviews"),
      where("userId", "==", userId)
    );

    const unsubscribe = onSnapshot(
      interviewQuery,
      (snapshot) => {
        setInterviews(
          snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Interview[]
        );
        setLoading(false);
      },
      (error) => {
        console.error("Failed to fetch interviews", error);
        setFailed(true);
        setLoading(false);
        toast.error("Could not load your interviews", {
          description: "Check your connection and refresh the page.",
        });
      }
    );

    return () => unsubscribe();
  }, [userId]);

  return (
    <>
      <div className="flex w-full flex-wrap items-center justify-between gap-4">
        <Headings
          title="Your interviews"
          description="Set up a mock interview, then answer it out loud."
        />
        <Button asChild size="sm">
          <Link to="/generate/create">
            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            New interview
          </Link>
        </Button>
      </div>

      <div className="mt-6">
        <ResumeCard />
      </div>

      <Separator className="my-8" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {loading ? (
          Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-48 rounded-lg" />
          ))
        ) : failed ? (
          <div className="col-span-full flex flex-col items-center gap-3 rounded-lg border bg-surface px-6 py-16 text-center">
            <h2 className="text-lg font-semibold">We could not load your interviews</h2>
            <p className="max-w-[46ch] text-pretty text-sm text-ink-muted">
              This is usually a connection problem rather than lost data.
              Refreshing the page normally fixes it.
            </p>
            <Button variant="secondary" size="sm" onClick={() => window.location.reload()}>
              Refresh
            </Button>
          </div>
        ) : interviews.length > 0 ? (
          interviews.map((interview) => (
            <InterviewPin key={interview.id} interview={interview} />
          ))
        ) : (
          /* First run. The job here is to get them speaking, not to announce
             that a database query returned zero rows. */
          <div className="col-span-full flex flex-col items-center gap-4 rounded-lg border bg-surface px-6 py-16 text-center">
            <span
              className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-2"
              aria-hidden="true"
            >
              <Mic className="h-5 w-5 text-ink-muted" />
            </span>
            <div className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold">Set up your first interview</h2>
              <p className="max-w-[52ch] text-pretty text-sm text-ink-muted">
                Tell us the role you are going for and we will write five
                questions for it. You answer them out loud with your camera on,
                and get scored feedback on each one.
              </p>
            </div>
            <Button asChild className="mt-1">
              <Link to="/generate/create">
                <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Create an interview
              </Link>
            </Button>
          </div>
        )}
      </div>
    </>
  );
};

export default Dashboard;
