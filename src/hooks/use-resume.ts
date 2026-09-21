import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/providers/auth-context";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/config/firebase.config";
import type { ResumeProfile } from "@/lib/ai/resume";

export interface StoredResume {
  profile: ResumeProfile;
  fileName: string;
}

/**
 * The CV belongs to the person, not to one interview, so it lives on the user
 * document and every interview they create reuses it.
 *
 * Each interview still stores its own snapshot of the profile at generation
 * time: a CV replaced next month does not retroactively change which claims
 * last month's questions were grounded in.
 */
export function useResume() {
  const { userId } = useAuth();
  const [resume, setResume] = useState<StoredResume | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    const unsubscribe = onSnapshot(
      doc(db, "users", userId),
      (snap) => {
        const data = snap.data();
        setResume(
          data?.resume
            ? {
                profile: data.resume as ResumeProfile,
                fileName: (data.resumeFileName as string) ?? "Your CV",
              }
            : null
        );
        setLoading(false);
      },
      (error) => {
        console.error("Failed to read stored CV", error);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [userId]);

  const save = useCallback(
    async (profile: ResumeProfile, fileName: string) => {
      if (!userId) return;
      await setDoc(
        doc(db, "users", userId),
        { resume: profile, resumeFileName: fileName, resumeUpdatedAt: serverTimestamp() },
        { merge: true }
      );
    },
    [userId]
  );

  const clear = useCallback(async () => {
    if (!userId) return;
    await setDoc(
      doc(db, "users", userId),
      { resume: null, resumeFileName: null, resumeUpdatedAt: serverTimestamp() },
      { merge: true }
    );
  }, [userId]);

  return { resume, loading, save, clear };
}
