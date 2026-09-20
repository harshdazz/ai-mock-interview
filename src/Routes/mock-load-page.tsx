import { db } from "@/config/firebase.config";
import type { Interview } from "@/types";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import LoaderPage from "./loader-page";
import { CustomBreadCrumb } from "@/components/custom-bread-crumb";
import { Button } from "@/components/ui/button";
import { FileText, Lightbulb, Sparkles, WebcamIcon } from "lucide-react";
import InterviewPin from "@/components/pin";
import { ResumeClaims } from "@/components/resume-upload";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import WebCam from "react-webcam";

const MockLoadPage = () => {
      const { interviewId } = useParams<{ interviewId: string }>();
  const [interview, setInterview] = useState<Interview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWebCamEnabled, setIsWebCamEnabled] = useState(false);

    useEffect(() => {
        const fetchInterview = async () => {
            if (interviewId) {
             try {
                const interviewDoc = await getDoc(doc(db, "interviews", interviewId))
                if (interviewDoc.exists()) {
                    setInterview({id: interviewDoc.id,...interviewDoc.data()} as Interview)
                }   
             } catch (error) {
                console.error("Failed to load interview", error)
             } finally {
                setIsLoading(false)
             }
            } else {
                setIsLoading(false)
            }
        }
        fetchInterview()
    }, [interviewId])
  if (!interviewId) {
    return <Navigate to="/generate" replace />;
  }

  if (isLoading) {
        return <LoaderPage className="w-full h-[70vh]" />;
    }

  return (
    <div  className="flex flex-col w-full gap-8 py-5" >
         <div className="flex items-center justify-between w-full gap-2">
        <CustomBreadCrumb
          breadCrumbPage={interview?.position || ""}
          breadCrumpItems={[{ label: "Mock Interviews", link: "/generate" }]}
        />

        <Link to={`/generate/interview/${interviewId}/start`}>
          <Button size={"sm"}>
            Start <Sparkles />
          </Button>
        </Link>
      </div>
      {interview && <InterviewPin interview={interview} onMockPage />}

      {/* What these questions were actually built from. The interview stores
          its own snapshot, so replacing your CV later does not rewrite the
          history of questions already generated. */}
      {interview?.resume && (
        <section className="flex flex-col gap-3 rounded-lg border bg-surface p-5 -mt-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-ink-muted" aria-hidden="true" />
            <h2 className="text-sm font-medium">Grounded in your CV</h2>
          </div>
          <ResumeClaims
            profile={interview.resume}
            limit={6}
            label="These questions dig into"
          />
        </section>
      )}
       <Alert className="bg-warning/10 border-warning/30 p-4 rounded-lg flex items-start gap-3 -mt-3">
        <Lightbulb className="h-5 w-5 text-warning" />
        <div>
          <AlertTitle className="text-warning font-semibold">
            Important Information
          </AlertTitle>
          <AlertDescription className="text-sm text-warning mt-1">
            Please enable your webcam and microphone to start the AI-generated
            mock interview. The interview consists of five questions. You’ll
            receive a personalized report based on your responses at the end.{" "}
            <br />
            <br />
            <span className="font-medium">Note:</span> Your video is{" "}
            <strong>never recorded</strong>. You can disable your webcam at any
            time.
          </AlertDescription>
        </div>
      </Alert>

      <div className="flex items-center justify-center w-full h-full">
          <div className="w-full h-[400px] md:w-96 flex flex-col items-center justify-center border p-4 bg-surface rounded-md">
               {isWebCamEnabled ? (
            <WebCam
              onUserMedia={() => setIsWebCamEnabled(true)}
              onUserMediaError={() => setIsWebCamEnabled(false)}
              className="w-full h-full object-cover rounded-md"
            />
          ) : (
            <WebcamIcon className="min-w-24 min-h-24 text-muted-foreground" />
          )}
          </div>

      </div>
         <div className="flex items-center justify-center">
        <Button onClick={() => setIsWebCamEnabled(!isWebCamEnabled)}>
          {isWebCamEnabled ? "Disable Webcam" : "Enable Webcam"}
        </Button>
      </div>
    </div>
  )
}

export default MockLoadPage