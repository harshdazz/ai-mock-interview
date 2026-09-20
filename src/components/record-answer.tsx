import { useAuth } from "@clerk/clerk-react";
import { CircleStop, Loader, Mic, RefreshCw, Save, Video, VideoOff, WebcamIcon } from "lucide-react";
import { useEffect, useState } from "react";
import useSpeechToText, { type ResultType } from 'react-hook-speech-to-text';
import { useParams } from "react-router-dom";
import WebCam from "react-webcam";
import { TooltipButton } from "./tooltip-button";
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

      if (userAnswer?.length < 30) {
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


  return (
    <div className="w-full flex flex-col items-center gap-8 mt-4">
        {/* save model */}
          <SaveModal
        isOpen={open}
        onClose={() => setOpen(false)}
        onConfirm={saveUserAnswer}
        loading={loading}
      />

         <div className="w-full h-[400px] md:w-96 flex flex-col items-center justify-center border p-4 bg-gray-50 rounded-md">
               {isWebCam ? (
            <WebCam
              onUserMedia={() => setIsWebCam(true)}
              onUserMediaError={() => setIsWebCam(false)}
              className="w-full h-full object-cover rounded-md"
            />
          ) : (
            <WebcamIcon className="min-w-24 min-h-24 text-muted-foreground" />
          )}
          </div>

            <div className="flex items-center justify-center gap-3">
        <TooltipButton
          content={isWebCam ? "Turn Off" : "Turn On"}
          icon={
            isWebCam ? (
              <VideoOff className="min-w-5 min-h-5" />
            ) : (
              <Video className="min-w-5 min-h-5" />
            )
          }
          onClick={() => setIsWebCam(!isWebCam)}
        />

          <TooltipButton
          content={isRecording ? "Stop Recording" : "Start Recording"}
          icon={
            isRecording ? (
              <CircleStop className="min-w-5 min-h-5" />
            ) : (
              <Mic className="min-w-5 min-h-5" />
            )
          }
          onClick={recordUserAnswer}
        />

          <TooltipButton
          content="Record Again"
          icon={<RefreshCw className="min-w-5 min-h-5" />}
          onClick={recordNewAnswer}
        />

         <TooltipButton
          content="Save Result"
          icon={
            isAiGenerating ? (
              <Loader className="min-w-5 min-h-5 animate-spin" />
            ) : (
              <Save className="min-w-5 min-h-5" />
            )
          }
          onClick={() => setOpen(!open)}
          disabled={!aiResult}
        />
        </div>

           <div className="w-full mt-4 p-4 border rounded-md bg-gray-50">
        <h2 className="text-lg font-semibold">Your Answer:</h2>

         <p className="text-sm mt-2 text-gray-700 whitespace-normal">
          {userAnswer || "Start recording to see your answer here"}
        </p>

         {interimResult && (
          <p className="text-sm text-gray-500 mt-2">
            <strong>Current Speech:</strong>
            {interimResult}
          </p>
        )}
        </div>

    </div>
  )
}

export default RecordAnswer