import { db } from "@/config/firebase.config";
import LoaderPage from "@/Routes/loader-page";
import type { User } from "@/types";
import { useAuth, useUser } from "@clerk/clerk-react";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { useFirebaseAuth } from "@/hooks/use-firebase-auth";

/**
 * Creates the Firestore user record once, the first time a signed-in user is
 * seen. Keyed on user.id only: adding pathname here would re-read the document
 * on every navigation, which is a billable read that can never change anything.
 */
const AuthHandler = () => {
  const { isSignedIn } = useAuth();
  // Exchanges the Clerk session for a Firebase one so Firestore rules can
  // identify the caller. Mounted here because this component already runs on
  // every layout.
  useFirebaseAuth();
  const { user } = useUser();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isSignedIn || !user) return;

    let cancelled = false;

    const storeUserData = async () => {
      setLoading(true);
      try {
        const userRef = doc(db, "users", user.id);
        const userSnap = await getDoc(userRef);
        if (cancelled || userSnap.exists()) return;

        const userData: User = {
          id: user.id,
          name: user.fullName || user.firstName || "Anonymous",
          email: user.primaryEmailAddress?.emailAddress || "No Email",
          imageUrl: user.imageUrl,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        await setDoc(userRef, userData);
      } catch (error) {
        console.error("Failed to store user data", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    storeUserData();
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, user]);

  if (loading) return <LoaderPage />;
  return null;
};

export default AuthHandler;
