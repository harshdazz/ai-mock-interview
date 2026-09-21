import { db } from "@/config/firebase.config";
import LoaderPage from "@/Routes/loader-page";
import type { User } from "@/types";
import { useAuth } from "@/providers/auth-context";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";

/**
 * Creates the Firestore user record once, the first time a signed-in user is
 * seen. Keyed on the uid only: adding pathname here would re-read the document
 * on every navigation, which is a billable read that can never change anything.
 */
const AuthHandler = () => {
  const { isSignedIn, user } = useAuth();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isSignedIn || !user) return;

    let cancelled = false;

    const storeUserData = async () => {
      setLoading(true);
      try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (cancelled || userSnap.exists()) return;

        const userData: User = {
          id: user.uid,
          name: user.displayName || user.email?.split("@")[0] || "Anonymous",
          email: user.email || "No Email",
          imageUrl: user.photoURL || "",
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
