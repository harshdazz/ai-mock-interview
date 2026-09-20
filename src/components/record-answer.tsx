import { useAuth } from "@clerk/clerk-react";
import { CircleStop, Loader, Mic, RefreshCw, Save, Video, VideoOff, WebcamIcon } from "lucide-react";
import { useEffect, useState } from "react";
import useSpeechToText, { type ResultType } from 'react-hook-speech-to-text';
import { useParams } from "react-router-dom";
import WebCam from "react-webcam";
import { TooltipButton } from "./tooltip-button";
import { Button } from "@/components/ui/button";
import { TallyLight } from "./session/tally-light";
import { LiveTranscript } from "./session/live-transcript";
import { ScoreDial } from "./session/score-dial";
import { toast } from "sonner";
import { generateFeedback, type AnswerFeedback } from "@/lib/ai/interview";
import { AiError } from "@/lib/ai/client";
import { SaveModal } from "./save-modal";
import { addDoc, collection, getDocs, query, serverTimestamp, where } from "firebase/firestore";
import { db } from "@/config/firebase.config";


interface RecordAnswerProps {
  question: { question: string; answer: string };
  isWebCam: boolean;
  setIsWebCam: (value: boolean) => void;
}

const MIN_ANSWER_CHARS = 30;

const RecordAnswer = ({ question, isWebCam, setIsWebCam }: RecordAnswerProps) => {
     const {
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

  const { userId } = useAuth();
  const { interviewId } = useParams();

    const recordUserAnswer = async() => {
          if (isRecording) {
      stopSpeechToText();

      if (userAnswer.trim().length < MIN_ANSWER_CHARS) {
        toast.error("Answer too short", {
          description: "Say a bit more before asking for feedback, at least a couple of sentences.",
        });

        return;

      }

        setIsAiGenerating(true);
      try {
        const feedback = await generateFeedback({
          question: question.question,
          modelAnswer: question.answer,
          userAnswer,
        });
        setAiResult(feedback);
      } catch (error) {
        console.error("Failed to generate feedback", error);
        setAiResult(null);
        toast.error(
          error instanceof AiError && error.retryable
            ? "Model is busy"
            : "Could not grade that answer",
          {
            description:
              error instanceof AiError
                ? error.message
                : "Your answer was kept. Press the microphone again to retry.",
          }
        );
      } finally {
        setIsAiGenerating(false);
      }
    } else {
        startSpeechToText();
    }
}

  const recordNewAnswer = () => {
    setAiResult(null);
    setUserAnswer("");
    stopSpeechToText();
    startSpeechToText();
  };

   const saveUserAnswer = async () => {
    if (!aiResult) {
      toast.error("No feedback yet", {
        description: "Record an answer and wait for feedback before saving.",
      });
      return;
    }

    setLoading(true);
    const currentQuestion = question.question;
    try {
      // query the firbase to check if the user answer already exists for this question

      const userAnswerQuery = query(
        collection(db, "userAnswers"),
        where("userId", "==", userId),
        where("mockIdRef", "==", interviewId),
        where("question", "==", currentQuestion)
      );

      const querySnap = await getDocs(userAnswerQuery);

      // if the user already answerd the question dont save it again
      if (!querySnap.empty) {
        toast.info("Already Answered", {
          description: "You have already answered this question",
        });
        return;
      } else {
        // save the user answer

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

        toast("Saved", { description: "Your answer has been saved.." });
      }

      setUserAnswer("");
      stopSpeechToText();
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

    useEffect(() => {
    const combineTranscripts = results
      .filter((result): result is ResultType => typeof result !== "string")
      .map((result) => result.transcript)
      .join(" ");

    setUserAnswer(combineTranscripts);
  }, [results]);



  const canSave = Boolean(aiResult) && !isAiGenerating;

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
                  Camera is off. You can still record audio, but watching
                  yourself back is most of the value.
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
            {!isRecording && <TallyLight isRecording={false} />}
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
                disabled={isAiGenerating}
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

          <Button
            size="lg"
            variant={isRecording ? "secondary" : "default"}
            className="w-full"
            onClick={recordUserAnswer}
            disabled={isAiGenerating}
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
        </div>

        <div className="flex flex-col gap-6">
          <LiveTranscript
            finalText={userAnswer}
            interimText={interimResult}
            isRecording={isRecording}
            minChars={MIN_ANSWER_CHARS}
          />

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
