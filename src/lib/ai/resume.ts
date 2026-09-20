import { Type } from "@google/genai";
import type { Schema } from "@google/genai";
import { AiError, generateFromParts } from "./client";

export interface ResumeProject {
  name: string;
  whatTheyDid: string;
  tech: string[];
}

export interface ResumeProfile {
  currentRole: string;
  yearsExperience: number;
  techStack: string[];
  projects: ResumeProject[];
  /** Concrete claims an interviewer can drill into, close to the CV's wording. */
  talkingPoints: string[];
}

export const resumeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    currentRole: { type: Type.STRING },
    yearsExperience: { type: Type.NUMBER },
    techStack: { type: Type.ARRAY, items: { type: Type.STRING } },
    projects: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          whatTheyDid: { type: Type.STRING },
          tech: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["name", "whatTheyDid", "tech"],
      },
    },
    talkingPoints: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        "Specific decisions or measured results, quoted close to the CV's own wording.",
    },
  },
  required: ["currentRole", "yearsExperience", "techStack", "projects", "talkingPoints"],
};

export const MAX_RESUME_BYTES = 5 * 1024 * 1024;
export const ACCEPTED_RESUME_TYPES = ["application/pdf"];

/**
 * Gemini reads PDFs natively, so the file goes to the API as inline base64 and
 * there is no pdf.js in the bundle and no text-extraction step to get wrong.
 */
const fileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new AiError("unknown", "Could not read that file"));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new AiError("unknown", "Could not read that file"));
        return;
      }
      // Strip the "data:application/pdf;base64," prefix.
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.readAsDataURL(file);
  });

export function validateResumeFile(file: File): string | null {
  if (!ACCEPTED_RESUME_TYPES.includes(file.type)) {
    return "That file is not a PDF. Export your CV as a PDF and try again.";
  }
  if (file.size > MAX_RESUME_BYTES) {
    return "That PDF is larger than 5MB. Most CVs are well under 1MB.";
  }
  if (file.size === 0) {
    return "That file is empty.";
  }
  return null;
}

export async function extractResume(
  file: File,
  signal?: AbortSignal
): Promise<ResumeProfile> {
  const invalid = validateResumeFile(file);
  if (invalid) throw new AiError("unknown", invalid);

  const data = await fileToBase64(file);

  const profile = await generateFromParts<ResumeProfile>({
    parts: [
      { inlineData: { mimeType: file.type, data } },
      {
        text: `Extract this candidate's background from their CV.

talkingPoints must be specific decisions or measured results an interviewer could drill into, kept close to how the CV words them. Prefer claims with a number, a trade-off, or a named system. Skip responsibilities that any holder of the role would list.

Ignore contact details, addresses and any other personal information. If the CV does not state years of experience, infer it from the employment dates.`,
      },
    ],
    schema: resumeSchema,
    thinkingBudget: 0,
    signal,
  });

  // A CV with no readable text (a scan, or an export with no text layer) comes
  // back structurally valid but empty, which would silently produce generic
  // questions. Better to say so.
  const empty =
    profile.techStack.length === 0 &&
    profile.projects.length === 0 &&
    profile.talkingPoints.length === 0;
  if (empty) {
    throw new AiError(
      "malformed",
      "We could not read anything from that PDF. If it is a scan, export a version with selectable text."
    );
  }

  return profile;
}

/** The CV section of the question-generation prompt. */
export function resumePromptSection(profile: ResumeProfile): string {
  const projects = profile.projects
    .map((p) => `- ${p.name}: ${p.whatTheyDid} (${p.tech.join(", ")})`)
    .join("\n");
  const claims = profile.talkingPoints.map((c) => `- ${c}`).join("\n");

  return `

The candidate's CV says the following. Ground at least three of the five questions in specific things they claim here, naming the project or result so they have to defend their own work rather than answer in the abstract. Do not ask about anything that is not evidenced below.

Current role: ${profile.currentRole} (${profile.yearsExperience} years)
Tech: ${profile.techStack.join(", ")}
${projects ? `Projects:\n${projects}` : ""}
${claims ? `Claims:\n${claims}` : ""}`;
}
