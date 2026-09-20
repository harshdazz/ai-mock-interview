import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { TooltipButton } from "./tooltip-button";
import { Volume2, VolumeX } from "lucide-react";
import RecordAnswer from "./record-answer";

const SUPPORTS_SPEECH =
  typeof window !== "undefined" && "speechSynthesis" in window;

interface QuestionSectionProps {
  questions: { question: string; answer: string }[];
}

const QuestionSection = ({ questions }: QuestionSectionProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isWebCam, setIsWebCam] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  // Without this, navigating away mid-sentence left the browser reading the
  // question out loud with no visible control to stop it.
  useEffect(() => {
    return () => {
      if (SUPPORTS_SPEECH) window.speechSynthesis.cancel();
    };
  }, []);

  const handlePlayQuestion = (qst: string) => {
    if (!SUPPORTS_SPEECH) return;

    if (isPlaying) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      return;
    }

    // Cancel anything queued from a previous question before starting.
    window.speechSynthesis.cancel();
    const speech = new SpeechSynthesisUtterance(qst);
    speech.onend = () => setIsPlaying(false);
    speech.onerror = () => setIsPlaying(false);
    window.speechSynthesis.speak(speech);
    setIsPlaying(true);
  };

  const switchTo = (index: number) => {
    if (SUPPORTS_SPEECH) window.speechSynthesis.cancel();
    setIsPlaying(false);
    setActiveIndex(index);
  };

  return (
    <Tabs
      value={String(activeIndex)}
      onValueChange={(value) => switchTo(Number(value))}
      className="flex w-full flex-col gap-8"
    >
      {/* Progress rail. Keyed by index, not by question text: two questions
          with the same wording collided as React keys and as tab values. */}
      <TabsList className="flex h-auto w-full flex-wrap items-center justify-start gap-2 bg-transparent p-0">
        {questions.map((_, i) => (
          <TabsTrigger
            key={i}
            value={String(i)}
            className={cn(
              "tabular rounded-full border px-3.5 py-1.5 text-xs font-medium text-ink-muted",
              "data-[state=active]:border-primary data-[state=active]:bg-primary",
              "data-[state=active]:text-primary-foreground data-[state=active]:shadow-none"
            )}
          >
            <span className="sr-only">Question </span>
            {i + 1}
          </TabsTrigger>
        ))}
        <span className="tabular ml-1 text-xs text-ink-faint">
          {activeIndex + 1} of {questions.length}
        </span>
      </TabsList>

      {questions.map((tab, i) => (
        <TabsContent
          key={i}
          value={String(i)}
          className="mt-0 flex flex-col gap-6 focus-visible:outline-none"
        >
          <div className="flex items-start justify-between gap-4">
            {/* The question is the largest thing on this screen. It used to be
                rendered at body size in the faintest colour in the palette. */}
            <h2 className="text-balance text-xl font-medium leading-snug tracking-[-0.01em] text-ink sm:text-2xl">
              {tab.question}
            </h2>

            {SUPPORTS_SPEECH && (
              <TooltipButton
                content={isPlaying ? "Stop reading" : "Read question aloud"}
                icon={
                  isPlaying ? (
                    <VolumeX className="h-5 w-5" />
                  ) : (
                    <Volume2 className="h-5 w-5" />
                  )
                }
                onClick={() => handlePlayQuestion(tab.question)}
                buttonClassName="shrink-0"
              />
            )}
          </div>

          <RecordAnswer
            question={tab}
            isWebCam={isWebCam}
            setIsWebCam={setIsWebCam}
          />
        </TabsContent>
      ))}
    </Tabs>
  );
};

export default QuestionSection;
