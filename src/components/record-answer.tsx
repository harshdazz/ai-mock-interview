import { useAuth } from "@/providers/auth-context";
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
import { useEffect, useRef, useState } from "react";
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
import { assessAnswer, gradeAnswer } from "@/lib/ai/api";
import type { Assessment } from "@/lib/ai/followup";
import type { ResumeProfile } from "@/lib/ai/resume";
import { describeGrade, type AnswerGrade } from "@/lib/ai/scoring";
import { AiError } from "@/lib/ai/errors";
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
import type { InterviewQuestion } from "@/types";

interface RecordAnswerProps {
  question: InterviewQuestion;
  /** The CV the interview was generated from. Enables the CV claim check. */
  resume?: ResumeProfile | null;
  isWebCam: boolean;
  setIsWebCam: (value: boolean) => void;
}

const MIN_ANSWER_CHARS = 30;
/** A follow-up answer can be one sharp sentence. */
const MIN_FOLLOW_UP_CHARS = 10;

type AnswerMode = "speak" | "type";

/**
 * One question is a short exchange, as in the room: the answer, then at most
 * one follow-up from the interviewer, then the score.
 */
type Phase = "answering" | "followUp" | "graded";

const RecordAnswer = ({ question, resume, isWebCam, setIsWebCam }: RecordAnswerProps) => {
  const {
    error: speechError,
    interimResult,
    isRecording,
    results,
    setResults,
    startSpeechToText,
    stopSpeechToText,
  } = useSpeechToText({
    continuous: true,
    useLegacyResults: false,
  });

  const [userAnswer, setUserAnswer] = useState("");
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [aiResult, setAiResult] = useState<AnswerGrade | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<AnswerMode>("speak");
  const [phase, setPhase] = useState<Phase>("answering");
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [followUpAnswer, setFollowUpAnswer] = useState("");
  // Speech results only ever grow, so the follow-up's words are the ones after
  // this index. A ref keeps the count current inside the async handler.
  const [followUpFrom, setFollowUpFrom] = useState(0);
  const resultCount = useRef(0);

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
    resultCount.current = results.length;
    // Only the speaking mode is driven by the transcript. Without this guard a
    // late results update would wipe out what someone had typed.
    if (mode !== "speak") return;
    const spoken = results
      .filter((result): result is ResultType => typeof result !== "string")
      .map((result) => result.transcript);
    if (phase === "answering") setUserAnswer(spoken.join(" "));
    if (phase === "followUp") setFollowUpAnswer(spoken.slice(followUpFrom).join(" "));
  }, [results, mode, phase, followUpFrom]);

  const reportFailure = (error: unknown) => {
    console.error("Failed to generate feedback", error);
    toast.error(
      error instanceof AiError && error.kind === "rate_limited"
        ? "AI usage limit reached"
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
  };

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
      const result = await assessAnswer({
        question: question.question,
        modelAnswer: question.answer,
        keyPoints: question.keyPoints,
        answer,
        resume,
      });
      setAssessment(result);
      if (result.followUp) {
        // The score waits until the follow-up is answered: showing the missed
        // points now would hand over the answer to the follow-up.
        setFollowUpFrom(resultCount.current);
        setFollowUpAnswer("");
        setPhase("followUp");
      } else {
        setAiResult(result.grade);
        setPhase("graded");
      }
    } catch (error) {
      setAiResult(null);
      reportFailure(error);
    } finally {
      setIsAiGenerating(false);
    }
  };

  const answerFollowUp = async (answer: string) => {
    if (answer.trim().length < MIN_FOLLOW_UP_CHARS) {
      toast.error("Answer too short", {
        description: "Answer the follow-up out loud, or skip it to see your score.",
      });
      return;
    }

    setIsAiGenerating(true);
    try {
      // Graded as one answer: a key point made under follow-up counts, the
      // way it would with a real interviewer.
      const grade = await gradeAnswer({
        question: question.question,
        modelAnswer: question.answer,
        keyPoints: question.keyPoints,
        answer: `${userAnswer}\n\n${answer}`,
      });
      setAiResult(grade);
      setPhase("graded");
    } catch (error) {
      reportFailure(error);
    } finally {
      setIsAiGenerating(false);
    }
  };

  const skipFollowUp = () => {
    if (!assessment) return;
    if (isRecording) stopSpeechToText();
    setFollowUpAnswer("");
    setAiResult(assessment.grade);
    setPhase("graded");
  };

  const recordUserAnswer = async () => {
    if (isRecording) {
      stopSpeechToText();
      if (phase === "followUp") await answerFollowUp(followUpAnswer);
      else await requestFeedback(userAnswer);
    } else {
      startSpeechToText();
    }
  };

  const recordNewAnswer = () => {
    setAiResult(null);
    setAssessment(null);
    setPhase("answering");
    setUserAnswer("");
    setFollowUpAnswer("");
    setFollowUpFrom(0);
    // Without clearing these, the next results update rebuilt the old
    // transcript on top of the new one.
    setResults([]);
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
        feedback: describeGrade(aiResult),
        rating: aiResult.score,
        criteria: aiResult.points,
        advice: aiResult.advice,
        // An empty answer means the follow-up was skipped.
        ...(assessment?.followUp && {
          followUp: {
            question: assessment.followUp.question,
            answer: followUpAnswer,
            scoreBefore: assessment.grade.score,
          },
        }),
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

  const canSave = phase === "graded" && Boolean(aiResult) && !isAiGenerating;
  const busy = isAiGenerating || loading;
  const inFollowUp = phase === "followUp" && assessment?.followUp;
  // What the transcript box and the text box show: the follow-up answer while
  // it is being given, the main answer otherwise.
  const current = inFollowUp ? followUpAnswer : userAnswer;
  const setCurrent = inFollowUp ? setFollowUpAnswer : setUserAnswer;
  const minChars = inFollowUp ? MIN_FOLLOW_UP_CHARS : MIN_ANSWER_CHARS;
  const answeredFollowUp =
    phase === "graded" && assessment?.followUp && followUpAnswer.trim().length > 0;

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
              // Once scored, a new attempt goes through "Start over", so a
              // fresh answer is never graded on top of the old transcript.
              disabled={busy || phase === "graded"}
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
                  {inFollowUp ? "Answer the follow-up" : "Record your answer"}
                </>
              )}
            </Button>
          ) : (
            <Button
              size="lg"
              className="w-full"
              onClick={() =>
                inFollowUp ? answerFollowUp(followUpAnswer) : requestFeedback(userAnswer)
              }
              disabled={busy || phase === "graded" || current.trim().length === 0}
            >
              {isAiGenerating ? (
                <>
                  <Loader className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Grading your answer
                </>
              ) : inFollowUp ? (
                "Answer the follow-up"
              ) : (
                "Get feedback"
              )}
            </Button>
          )}

          {inFollowUp && (
            <Button variant="ghost" size="sm" onClick={skipFollowUp} disabled={busy}>
              Skip the follow-up and see your score
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
          {inFollowUp && (
            <section
              className="flex animate-fade-up flex-col gap-2 rounded-lg border bg-surface p-5"
              aria-live="polite"
            >
              <h3 className="text-sm font-medium text-ink-muted">The interviewer follows up</h3>
              <p className="text-balance text-xl font-medium leading-snug text-ink">
                {inFollowUp.question}
              </p>
              <p className="text-pretty text-sm text-ink-faint">
                Answer it the same way. Your score comes after, and counts both answers.
              </p>
            </section>
          )}

          {mode === "speak" ? (
            <LiveTranscript
              finalText={current}
              interimText={interimResult}
              isRecording={isRecording}
              minChars={minChars}
            />
          ) : (
            <section
              className="flex flex-col gap-3"
              aria-label={inFollowUp ? "Your follow-up answer" : "Your answer"}
            >
              <header className="flex items-baseline justify-between gap-4">
                <label htmlFor="typed-answer" className="text-sm font-medium text-ink-muted">
                  {inFollowUp ? "Your follow-up answer" : "Your answer"}
                </label>
                {current.trim().length > 0 && (
                  <span
                    className={cn(
                      "tabular text-xs",
                      current.trim().length < minChars ? "text-warning" : "text-ink-faint"
                    )}
                  >
                    {current.trim().length} characters
                    {current.trim().length < minChars && ` · ${minChars} needed`}
                  </span>
                )}
              </header>
              <Textarea
                id="typed-answer"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                disabled={busy || phase === "graded"}
                rows={8}
                placeholder="Answer as you would out loud. Write it the way you would say it, not the way you would write documentation."
                className="min-h-40 resize-y text-[15px] leading-relaxed"
              />
            </section>
          )}

          {isAiGenerating && (
            <div className="flex items-center gap-3 rounded-lg border bg-surface p-5 text-sm text-ink-muted">
              <Loader className="h-4 w-4 animate-spin" aria-hidden="true" />
              {/* Generation runs 10-20s. An unexplained wait that long reads as
                  a hang, so say what is happening. */}
              {inFollowUp
                ? "Grading both answers against each key point. This usually takes about ten seconds."
                : "Checking your answer against each key point. This usually takes about fifteen seconds."}
            </div>
          )}

          {aiResult && !isAiGenerating && (
            <div className="flex flex-col gap-2">
              <ScoreDial
                rating={aiResult.score}
                feedback={aiResult.advice}
                points={aiResult.points}
                className="animate-fade-up"
              />
              {answeredFollowUp && (
                <p className="tabular text-pretty text-sm text-ink-muted">
                  Scored across your answer and the follow-up. Your first answer on
                  its own scored {assessment.grade.score}/10.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RecordAnswer;
