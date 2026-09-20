import {   z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { FormProvider, useForm, type Resolver } from "react-hook-form"


import type { Interview } from "@/types";
import { CustomBreadCrumb } from "./custom-bread-crumb";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import Headings from "./headings";
import { Button } from "./ui/button";
import { Loader, Trash2 } from "lucide-react";
import { Separator } from "./ui/separator";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "./ui/form";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { generateQuestions } from "@/lib/ai/interview";
import { AiError } from "@/lib/ai/client";
import { ResumeUpload } from "./resume-upload";
import type { ResumeProfile } from "@/lib/ai/resume";
import { addDoc, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/config/firebase.config";

interface FormMockInterviewProps {
    initialData : Interview | null;
}
const formSchema = z.object({
      position: z
    .string()
    .min(1, "Position is required")
    .max(100, "Position must be 100 characters or less"),
  description: z.string().min(10, "Description is required"),
   experience: z.coerce
    .number()
    .min(0, "Experience cannot be empty or negative"),
  techStack: z.string().min(1, "Tech stack must be at least a character"),
})

type FormData = z.infer<typeof formSchema>


const FormMockInterview = ( {initialData } : FormMockInterviewProps) => {

    const form = useForm<FormData>({
        resolver: zodResolver(formSchema) as Resolver<FormData>,
        defaultValues: initialData || {}
    })
    const {isValid, isSubmitting} = form.formState
    const [loading, setLoading] = useState(false)
    const [resume, setResume] = useState<ResumeProfile | null>(
      initialData?.resume ?? null
    )
    const navigate = useNavigate()
    const {userId} = useAuth()

    const title = initialData?.position ? initialData?.position : "Create a new Mock Interview"
    
      const breadCrumpPage = initialData? initialData?.position : "Create";
  const actions = initialData ? "Save Changes" : "Create";
  const toastMessage = initialData
    ? { title: "Updated..!", description: "Changes saved successfully..." }
    : { title: "Created..!", description: "New Mock Interview created..." };


    const onSubmit = async (data : FormData) => {
      try {
        setLoading(true)

        if(initialData){
          // update
          if(isValid){
             const aiResult = await generateQuestions(data, resume)
            await updateDoc(doc(db, "interviews", initialData.id), {

              questions : aiResult,
              resume : resume ?? null,
              ...data,
              updatedAt : serverTimestamp()
            })
             toast(toastMessage.title, {
              description : toastMessage.description
            })
          }

        } else{

        
  // create new mock interview
          if(isValid){
            const aiResult = await generateQuestions(data, resume)

            await addDoc(collection(db, "interviews"), {

              ...data,
              questions : aiResult,
              resume : resume ?? null,
              userId,
              createdAt : serverTimestamp()
            })

           

            toast(toastMessage.title, {
              description : toastMessage.description
            })
          }

        }

        navigate("/generate", {replace : true})
      } catch (error) {
      console.error("Failed to create interview", error);
      toast.error(
        error instanceof AiError
          ? error.kind === "rate_limited"
            ? "Daily API limit reached"
            : "Could not generate questions"
          : "Something went wrong",
        {
          description:
            error instanceof AiError
              ? error.message
              : "Your interview was not saved. Please try again.",
        }
      );
      return;
    } finally{
      setLoading(false)
    }
  }
    

    useEffect(() => {
        if (initialData) {
            form.reset({
                position : initialData.position,
                description : initialData.description,
                experience : initialData.experience,
                techStack : initialData.techStack
            })
        }
    }, [initialData, form])

  return (
    <div className="w-full flex-col space-y-4">
          <CustomBreadCrumb
        breadCrumbPage={breadCrumpPage}
        breadCrumpItems={[{ label: "Mock Interviews", link: "/generate" }]}
      />
      <div className="mt-4 flex items-center justify-between w-full">
        <Headings title={title} isSubHeading description={""} />

        {initialData && (
          <Button size={"icon"} variant={"ghost"}>
          <Trash2 className="min-w-4 min-h-4 text-warning" />
          </Button>

        )}
        </div>

        <Separator className="my-4" />

        <div>
          <FormProvider {...form}>
              <form
          onSubmit={form.handleSubmit(onSubmit)}  className="w-full p-8 rounded-lg flex-col flex items-start justify-start gap-6 shadow-md ">
             <FormField
            control={form.control}
            name="position"
            render={({ field }) => (
              <FormItem className="w-full space-y-4">
                <div className="w-full flex items-center justify-between">
                  <FormLabel>Job Role / Job Position</FormLabel>
                  <FormMessage className="text-sm" />
                </div>
                <FormControl>
                  <Textarea
                  {...field}
                    className="h-12"
                    disabled={loading}
                    placeholder="eg:-  describe your job role or position"
                    {...field}
                    value={field.value || ""}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          {/* description */}
           <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem className="w-full space-y-4">
                <div className="w-full flex items-center justify-between">
                  <FormLabel>Job Description</FormLabel>
                  <FormMessage className="text-sm" />
                </div>
                <FormControl>
                  <Input
                    className="h-12"
                    disabled={loading}
                    placeholder="eg:- Full Stack Developer"
                    {...field}
                    value={field.value || ""}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          {/* experince */}
           <FormField
            control={form.control}
            name="experience"
            render={({ field }) => (
              <FormItem className="w-full space-y-4">
                <div className="w-full flex items-center justify-between">
                  <FormLabel>Years of Experience</FormLabel>
                  <FormMessage className="text-sm" />
                </div>
                <FormControl>
                  <Input
                    type="number"
                    className="h-12"
                    disabled={loading}
                    placeholder="eg:- 5 years in number"
                    {...field}
                    value={field.value || ""}
                  />
                </FormControl>
              </FormItem>
            )}
          />

            <FormField
            control={form.control}
            name="techStack"
            render={({ field }) => (
              <FormItem className="w-full space-y-4">
                <div className="w-full flex items-center justify-between">
                  <FormLabel>Tech Stacks</FormLabel>
                  <FormMessage className="text-sm" />
                </div>
                <FormControl>
                  <Textarea
                    className="h-12"
                    disabled={loading}
                    placeholder="eg:- React, Typescript..."
                    {...field}
                    value={field.value || ""}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <div className="flex w-full flex-col gap-2">
            <FormLabel>Your CV</FormLabel>
            <ResumeUpload
              value={resume}
              onChange={setResume}
              disabled={loading || isSubmitting}
            />
          </div>

           <div className="w-full flex items-center justify-end gap-6">
            <Button
              type="reset"
              size={"sm"}
              variant={"outline"}
              disabled={isSubmitting || loading}
            >
              Reset
            </Button>
            <Button
              type="submit"
              size={"sm"}
              disabled={isSubmitting || !isValid || loading}
            >
              {loading ? (
                <Loader className="text-ink animate-spin" />
              ) : (
                actions
              )}
            </Button>
          </div>
          </form>
          </FormProvider>
        </div>


    </div>
  )
}

export default FormMockInterview