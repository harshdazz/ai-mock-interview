import type { Interview } from "@/types";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import LoaderPage from "./loader-page";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/config/firebase.config";
import { CustomBreadCrumb } from "@/components/custom-bread-crumb";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Lightbulb } from "lucide-react";
import QuestionSection from "@/components/question-section";

const MockInterviewPage = () => {
const { interviewId } = useParams<{ interviewId: string }>();
  const [interview, setInterview] = useState<Interview | null>(null);
  
    const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    setIsLoading(true);
    const fetchInterview = async () => {
      if (interviewId) {
        try {
          const interviewDoc = await getDoc(doc(db, "interviews", interviewId));
          if (interviewDoc.exists()) {
            setInterview({
              id: interviewDoc.id,
              ...interviewDoc.data(),
            } as Interview);
          }
        } catch (error) {
          console.error(error);
        } finally {
          setIsLoading(false);
        }
      }
    };

    fetchInterview();
  }, [interviewId, navigate]);

  if (isLoading) {
    return <LoaderPage className="w-full h-[70vh]" />;
  }

  if (!interviewId) {
    navigate("/generate", { replace: true });
  }

  if (!interview) {
    navigate("/generate", { replace: true });
  }

  return (
    <div className="flex flex-col w-full gap-8 py-5">
         <CustomBreadCrumb
        breadCrumbPage="Start"
        breadCrumpItems={[
          { label: "Mock Interviews", link: "/generate" },
          {
            label: interview?.position || "",
            link: `/generate/interview/${interview?.id}`,
          },
        ]}
      />

        <Alert className="flex items-start gap-3 rounded-lg border bg-surface p-4">
          <Lightbulb className="h-5 w-5 text-warning" />
          <div>
            <AlertTitle className="font-semibold text-ink">Before you start</AlertTitle>
            <AlertDescription className="text-sm text-ink-muted mt-1 leading-relaxed">
              Answer out loud, the way you would in the room. Press "Record your answer", speak, then stop to get scored feedback on what was missing.
              <br />
              <br />
              <span className="font-medium text-ink">Your video is never recorded or uploaded.</span>{" "}
              It is on screen so you can see yourself, and you can turn it off at any time.
            </AlertDescription>
          </div>
        </Alert>

       {interview?.questions && interview.questions.length > 0 && (
        <QuestionSection questions={interview.questions} />
      )}

    </div>
  )
}

export default MockInterviewPage