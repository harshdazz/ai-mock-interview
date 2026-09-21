import { useAuth } from "@clerk/clerk-react";
import {
  CircleStop,
  Keyboard,
  Loader,
  Mic,
  RefreshCw,
  Save,
  Video,
  VideoOff,
  WebcamIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import useSpeechToText, { type ResultType } from "react-hook-speech-to-text";
import { useParams } from "react-router-dom";
import WebCam from "react-webcam";
import { TooltipButton } from "./tooltip-button";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TallyLight } from "./session/tally-light";
import { LiveTranscript } from "./session/live-transcript";
import { ScoreDial } from "./session/score-dial";
import { toast } from "sonner";
import { generateFeedback, type AnswerFeedback } from "@/lib/ai/interview";
import { AiError } from "@/lib/ai/client";
import { SaveModal } from "./save-modal";
import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "@/config/firebase.config";
import { cn } from "@/lib/utils";

interface RecordAnswerProps {
  question: { question: string; answer: string };
  isWebCam: boolean;
  setIsWebCam: (value: boolean) => void;
}

const MIN_ANSWER_CHARS = 30;

type AnswerMode = "speak" | "type";

const RecordAnswer = ({ question, isWebCam, setIsWebCam }: RecordAnswerProps) => {
  const {
    error: speechError,
    interimResult,
    isRecording,
    results,
    startSpeechToText,
    stopSpeechToText,
  } = useSpeechToText({
    continuous: true,
    useLegacyResults: false,
  });

  const [userAnswer, setUserAnswer] = useState("");
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [aiResult, setAiResult] = useState<AnswerFeedback | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<AnswerMode>("speak");

  const { userId } = useAuth();
  const { interviewId } = useParams();

  /**
   * The Web Speech API is Chrome-only in practice, and the hook reports that
   * through `error`. It was previously never read, so in Firefox and Safari the
   * record button simply did nothing and said nothing, with no way to answer at
   * all. Falling back to typing keeps the product usable.
   */
  const speechUnavailable = Boolean(speechError);

  useEffect(() => {
    if (speechUnavailable) setMode("type");
  }, [speechUnavailable]);

  useEffect(() => {
    // Only the speaking mode is driven by the transcript. Without this guard a
    // late results update would wipe out what someone had typed.
    if (mode !== "speak") return;
    const combined = results
      .filter((result): result is ResultType => typeof result !== "string")
      .map((result) => result.transcript)
      .join(" ");
    setUserAnswer(combined);
  }, [results, mode]);

  const requestFeedback = async (answer: string) => {
    if (answer.trim().length < MIN_ANSWER_CHARS) {
      toast.error("Answer too short", {
        description:
          "Say a bit more before asking for feedback, at least a couple of sentences.",
      });
      return;
    }

    setIsAiGenerating(true);
    try {
      const feedback = await generateFeedback({
        question: question.question,
        modelAnswer: question.answer,
        userAnswer: answer,
      });
      setAiResult(feedback);
    } catch (error) {
      console.error("Failed to generate feedback", error);
      setAiResult(null);
      toast.error(
        error instanceof AiError && error.kind === "rate_limited"
          ? "Daily API limit reached"
          : error instanceof AiError && error.retryable
            ? "Model is busy"
            : "Could not grade that answer",
        {
          description:
            error instanceof AiError
              ? error.message
              : "Your answer was kept. Ask for feedback again to retry.",
        }
      );
    } finally {
      setIsAiGenerating(false);
    }
  };

  const recordUserAnswer = async () => {
    if (isRecording) {
      stopSpeechToText();
      await requestFeedback(userAnswer);
    } else {
      startSpeechToText();
    }
  };

  const recordNewAnswer = () => {
    setAiResult(null);
    setUserAnswer("");
    if (mode === "speak" && !speechUnavailable) {
      stopSpeechToText();
      startSpeechToText();
    }
  };

  const switchMode = (next: AnswerMode) => {
    if (next === mode) return;
    if (isRecording) stopSpeechToText();
    // Moving from speaking to typing keeps the transcript so it can be edited
    // rather than retyped.
    setMode(next);
  };

  const saveUserAnswer = async () => {
    if (!aiResult) {
      toast.error("No feedback yet", {
        description: "Get feedback on an answer before saving it.",
      });
      return;
    }

    setLoading(true);
    const currentQuestion = question.question;
    try {
      const userAnswerQuery = query(
        collection(db, "userAnswers"),
        where("userId", "==", userId),
        where("mockIdRef", "==", interviewId),
        where("question", "==", currentQuestion)
      );

      const querySnap = await getDocs(userAnswerQuery);

      if (!querySnap.empty) {
        toast.info("Already answered", {
          description: "You have already saved an answer to this question.",
        });
        return;
      }

      await addDoc(collection(db, "userAnswers"), {
        mockIdRef: interviewId,
        question: question.question,
        correct_ans: question.answer,
        user_ans: userAnswer,
        feedback: aiResult.feedback,
        rating: aiResult.rating,
        userId,
        createdAt: serverTimestamp(),
      });

      toast.success("Saved", { description: "Your answer has been saved." });
      setUserAnswer("");
      if (mode === "speak" && !speechUnavailable) stopSpeechToText();
    } catch (error) {
      console.error("Failed to save answer", error);
      toast.error("Could not save", {
        description: "Your answer was not saved. Please try again.",
      });
    } finally {
      setLoading(false);
      setOpen(false);
    }
  };

  const canSave = Boolean(aiResult) && !isAiGenerating;
  const busy = isAiGenerating || loading;

  return (
    <div className="flex w-full flex-col gap-6">
      <SaveModal
        isOpen={open}
        onClose={() => setOpen(false)}
        onConfirm={saveUserAnswer}
        loading={loading}
      />

      {/* Camera left, answer right. The feed never drops below 280px: smaller
          than that and it stops being useful for self-review. */}
      <div className="grid gap-6 lg:grid-cols-[minmax(280px,420px)_1fr] lg:items-start">
        <div className="flex flex-col gap-4">
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border bg-surface">
            {isWebCam ? (
              <WebCam
                audio={false}
                mirrored
                onUserMedia={() => setIsWebCam(true)}
                onUserMediaError={() => {
                  setIsWebCam(false);
                  toast.error("Camera unavailable", {
                    description:
                      "Check that no other app is using it and that the browser has permission.",
                  });
                }}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-6 text-center">
                <WebcamIcon className="h-10 w-10 text-ink-faint" aria-hidden="true" />
                <p className="text-sm text-ink-muted">
                  Camera is off. You can still answer, but watching yourself
                  back is most of the value.
                </p>
              </div>
            )}

            {isRecording && (
              <div className="absolute left-3 top-3">
                <TallyLight isRecording className="bg-background/80 backdrop-blur-sm" />
              </div>
            )}
          </div>

          {/* Controls sit with the camera, not in a page header: the user is
              looking here, so the controls belong in the same eye path. */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {mode === "speak" && !isRecording && <TallyLight isRecording={false} />}
            <div className="ml-auto flex items-center gap-1">
              <TooltipButton
                content={isWebCam ? "Turn camera off" : "Turn camera on"}
                icon={
                  isWebCam ? (
                    <VideoOff className="h-5 w-5" />
                  ) : (
                    <Video className="h-5 w-5" />
                  )
                }
                onClick={() => setIsWebCam(!isWebCam)}
              />
              <TooltipButton
                content="Start over"
                icon={<RefreshCw className="h-5 w-5" />}
                onClick={recordNewAnswer}
                disabled={busy}
              />
              <TooltipButton
                content="Save this result"
                icon={<Save className="h-5 w-5" />}
                onClick={() => setOpen(true)}
                disabled={!canSave}
                loading={loading}
              />
            </div>
          </div>

          {mode === "speak" ? (
            <Button
              size="lg"
              variant={isRecording ? "secondary" : "default"}
              className="w-full"
              onClick={recordUserAnswer}
              disabled={busy}
            >
              {isAiGenerating ? (
                <>
                  <Loader className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Grading your answer
                </>
              ) : isRecording ? (
                <>
                  <CircleStop className="mr-2 h-4 w-4" aria-hidden="true" />
                  Stop and get feedback
                </>
              ) : (
                <>
                  <Mic className="mr-2 h-4 w-4" aria-hidden="true" />
                  Record your answer
                </>
              )}
            </Button>
          ) : (
            <Button
              size="lg"
              className="w-full"
              onClick={() => requestFeedback(userAnswer)}
              disabled={busy || userAnswer.trim().length === 0}
            >
              {isAiGenerating ? (
                <>
                  <Loader className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Grading your answer
                </>
              ) : (
                "Get feedback"
              )}
            </Button>
          )}

          {/* Speaking is the point of the product, so typing is offered as a
              deliberate equal rather than hidden behind a failure. */}
          <div className="flex items-center gap-1 rounded-lg border bg-surface p-1">
            {(
              [
                { key: "speak", label: "Speak", icon: Mic },
                { key: "type", label: "Type", icon: Keyboard },
              ] as const
            ).map(({ key, label, icon: Icon }) => {
              const disabled = key === "speak" && speechUnavailable;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => switchMode(key)}
                  disabled={disabled || busy}
                  aria-pressed={mode === key}
                  title={
                    disabled
                      ? "This browser does not support speech recognition"
                      : undefined
                  }
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150",
                    mode === key
                      ? "bg-surface-2 text-ink"
                      : "text-ink-muted hover:text-ink",
                    disabled && "cursor-not-allowed opacity-50"
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {label}
                </button>
              );
            })}
          </div>

          {speechUnavailable && (
            <p className="text-pretty text-sm text-warning" role="status">
              This browser does not support speech recognition, so answers are
              typed here. Chrome supports speaking them out loud.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-6">
          {mode === "speak" ? (
            <LiveTranscript
              finalText={userAnswer}
              interimText={interimResult}
              isRecording={isRecording}
              minChars={MIN_ANSWER_CHARS}
            />
          ) : (
            <section className="flex flex-col gap-3" aria-label="Your answer">
              <header className="flex items-baseline justify-between gap-4">
                <label htmlFor="typed-answer" className="text-sm font-medium text-ink-muted">
                  Your answer
                </label>
                {userAnswer.trim().length > 0 && (
                  <span
                    className={cn(
                      "tabular text-xs",
                      userAnswer.trim().length < MIN_ANSWER_CHARS
                        ? "text-warning"
                        : "text-ink-faint"
                    )}
                  >
                    {userAnswer.trim().length} characters
                    {userAnswer.trim().length < MIN_ANSWER_CHARS &&
                      ` · ${MIN_ANSWER_CHARS} needed`}
                  </span>
                )}
              </header>
              <Textarea
                id="typed-answer"
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                disabled={busy}
                rows={8}
                placeholder="Answer as you would out loud. Write it the way you would say it, not the way you would write documentation."
                className="min-h-40 resize-y text-[15px] leading-relaxed"
              />
            </section>
          )}

          {isAiGenerating && (
            <div className="flex items-center gap-3 rounded-lg border bg-surface p-5 text-sm text-ink-muted">
              <Loader className="h-4 w-4 animate-spin" aria-hidden="true" />
              {/* Generation runs 8-12s. An unexplained wait that long reads as
                  a hang, so say what is happening. */}
              Comparing your answer against the model answer. This usually takes
              about ten seconds.
            </div>
          )}

          {aiResult && !isAiGenerating && (
            <ScoreDial
              rating={aiResult.rating}
              feedback={aiResult.feedback}
              className="animate-fade-up"
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default RecordAnswer;
