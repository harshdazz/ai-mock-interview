import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { onAuthStateChanged, signInWithCustomToken, signOut } from "firebase/auth";
import { auth } from "@/config/firebase.config";

/** Name of the JWT template configured in the Clerk dashboard. */
const FIREBASE_TEMPLATE = "integration_firebase";

export type FirebaseAuthState =
  | "pending"
  | "signed-in"
  | "signed-out"
  | "unconfigured";

/**
 * Signs the Clerk user in to Firebase so Firestore rules can identify them.
 *
 * Clerk owns the session, but Firestore does not know about Clerk: without this
 * exchange every request reaches Firestore anonymous, request.auth is null, and
 * no rule based on the caller can be written. The database then has to stay in
 * open test mode to work at all.
 *
 * Clerk mints a Firebase custom token from a JWT template; exchanging it makes
 * request.auth.uid the Clerk user id, which is what the rules in
 * firestore.rules match against.
 *
 * Returns "unconfigured" when the template is missing from the Clerk dashboard,
 * so the app keeps working against open rules rather than dying, and the reason
 * is visible in the console instead of surfacing as opaque permission errors.
 */
export function useFirebaseAuth(): FirebaseAuthState {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [state, setState] = useState<FirebaseAuthState>("pending");

  useEffect(() => {
    if (!isLoaded) return;
    let cancelled = false;

    const sync = async () => {
      if (!isSignedIn) {
        await signOut(auth).catch(() => {});
        if (!cancelled) setState("signed-out");
        return;
      }

      try {
        const token = await getToken({ template: FIREBASE_TEMPLATE });
        if (cancelled) return;

        if (!token) {
          console.warn(
            `[firebase] Clerk returned no token for the "${FIREBASE_TEMPLATE}" template. ` +
              "Firestore requests will be anonymous, so security rules that check " +
              "request.auth will deny them. Enable the Firebase integration in the " +
              "Clerk dashboard to fix this."
          );
          setState("unconfigured");
          return;
        }

        await signInWithCustomToken(auth, token);
        if (!cancelled) setState("signed-in");
      } catch (error) {
        if (cancelled) return;
        console.error("[firebase] Could not exchange the Clerk token", error);
        setState("unconfigured");
      }
    };

    sync();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!cancelled && user) setState("signed-in");
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [isLoaded, isSignedIn, getToken]);

  return state;
}
