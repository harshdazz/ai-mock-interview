import { Button } from "@/components/ui/button";
import Container from "@/components/ui/conatiner";
import { Link } from "react-router-dom";
import { SignedIn, SignedOut } from "@/providers/auth-provider";

/**
 * A still of the real session screen, built from the same tokens the product
 * uses, rather than a stock photo.
 *
 * The page previously shipped two AI-generated stock images (humanoid robots at
 * a desk, a glowing teal office) that had nothing to do with interview practice
 * and clashed with the palette. A product surface should show the product.
 */
const SessionPreview = () => (
  <div
    className="overflow-hidden rounded-xl border bg-surface shadow-2xl shadow-black/20"
    role="img"
    aria-label="The session screen: a webcam panel marked Recording beside the current question and a transcript of the answer being spoken."
  >
    <div className="flex items-center gap-2 border-b bg-surface-2 px-4 py-3">
      <span className="h-2.5 w-2.5 rounded-full bg-live" aria-hidden="true" />
      <span className="text-xs font-medium text-ink">Recording</span>
      <span className="tabular text-xs text-ink-muted">1:04</span>
      <span className="tabular ml-auto text-xs text-ink-faint">Question 2 of 5</span>
    </div>

    <div className="grid gap-5 p-5 sm:grid-cols-[1fr_1.1fr] sm:items-start">
      <div className="relative flex aspect-video items-end justify-center overflow-hidden rounded-lg border bg-background">
        {/* A figure, not an empty box. The real panel here is a live webcam
            feed, so a blank rectangle read as a broken image. */}
        <div className="flex flex-col items-center" aria-hidden="true">
          <span className="h-12 w-12 rounded-full bg-border" />
          <span className="-mt-1 h-16 w-28 rounded-t-[999px] bg-border" />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-pretty text-[15px] font-medium leading-snug text-ink">
          Walk me through a time you had to make a state management decision.
          What did you pick, and what would you do differently now?
        </p>

        <div className="flex flex-col gap-1.5 rounded-lg border bg-background p-3">
          <span className="text-[11px] font-medium text-ink-muted">Your answer</span>
          <p className="text-[13px] leading-relaxed text-ink-muted">
            So on the last project we put everything in Redux, and looking back
            most of that state was only ever read by one component
            <span className="font-light italic text-ink-faint"> which meant</span>
          </p>
        </div>

        <div className="flex flex-col gap-2 rounded-lg border bg-background p-3">
          <div className="flex items-baseline gap-1.5">
            <span className="tabular text-lg font-semibold text-warning">6</span>
            <span className="tabular text-[11px] text-ink-faint">/ 10</span>
            <span className="ml-auto text-[11px] font-medium text-warning">
              Partly there
            </span>
          </div>
          <div className="flex gap-1" aria-hidden="true">
            {Array.from({ length: 10 }, (_, i) => (
              <span
                key={i}
                className={
                  "h-1 flex-1 rounded-full " +
                  (i < 6 ? "bg-warning" : "bg-surface-2")
                }
              />
            ))}
          </div>
          <p className="text-[12px] leading-relaxed text-ink-muted">
            You named the tool but not the trade-off. Say what the state
            actually was, and why local state would have carried it.
          </p>
        </div>
      </div>
    </div>
  </div>
);

const STEPS = [
  {
    title: "Describe the role",
    body: "The position, the stack, and how much experience you have. Five questions get written for that specific job, not a generic list.",
  },
  {
    title: "Answer out loud",
    body: "Camera on, speaking, the way you would in the room. Your answer is transcribed as you talk so you can see what you actually said.",
  },
  {
    title: "Find out what was missing",
    body: "Each answer is scored against a model answer, with the specific gap named and a concrete revision to use next time.",
  },
];

const HomePage = () => {
  return (
    <div className="flex w-full flex-col pb-24">
      <Container>
        <section className="flex flex-col gap-8 py-14 sm:py-20">
          <div className="flex flex-col gap-5">
            <h1 className="max-w-3xl text-balance text-[clamp(1.75rem,6.5vw,4.25rem)] font-semibold leading-[1.02] tracking-[-0.03em]">
              You don't hear how weak the answer is until you say it out loud.
            </h1>
            <p className="max-w-[58ch] text-pretty text-lg leading-relaxed text-ink-muted">
              Reading interview questions and nodding along is not practice.
              This asks you the questions for the job you are actually applying
              for, makes you answer them into a camera, and tells you what was
              missing.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <SignedIn>
              <Button asChild size="lg">
                <Link to="/generate">Start an interview</Link>
              </Button>
            </SignedIn>
            <SignedOut>
              <Button asChild size="lg">
                <Link to="/signup">Start an interview</Link>
              </Button>
              <Button asChild size="lg" variant="ghost">
                <Link to="/signin">Sign in</Link>
              </Button>
            </SignedOut>
          </div>
        </section>

        <SessionPreview />

        <section className="flex flex-col gap-10 py-20">
          <h2 className="max-w-[24ch] text-balance text-[clamp(1.375rem,3.4vw,2.25rem)] font-semibold leading-tight tracking-[-0.02em]">
            Three steps, about fifteen minutes.
          </h2>

          <ol className="grid gap-x-10 gap-y-8 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex flex-col gap-2.5">
                <span className="tabular text-sm text-ink-faint">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="text-pretty text-lg font-medium leading-snug">
                  {step.title}
                </h3>
                <p className="text-pretty leading-relaxed text-ink-muted">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </section>

        <section className="flex flex-col items-start gap-6 border-t py-20">
          <h2 className="max-w-[20ch] text-balance text-[clamp(1.375rem,3.4vw,2.25rem)] font-semibold leading-tight tracking-[-0.02em]">
            Your video never leaves the browser.
          </h2>
          <p className="max-w-[62ch] text-pretty leading-relaxed text-ink-muted">
            The camera is there so you can watch yourself answer, which is most
            of the value and none of the comfort. Nothing is recorded, uploaded
            or stored. Only the text of your answer and the feedback on it are
            saved, and you can turn the camera off at any point.
          </p>
          <Button asChild size="lg" className="mt-2">
            <Link to="/generate">Start an interview</Link>
          </Button>
        </section>
      </Container>
    </div>
  );
};

export default HomePage;
