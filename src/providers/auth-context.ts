import { createContext, useContext } from "react";
import type { User as FirebaseUser } from "firebase/auth";

/**
 * Authentication is Firebase's, not Clerk's.
 *
 * Clerk owned the session while Firestore knew nothing about it, so every
 * request reached the database anonymous, request.auth was null, and no
 * security rule about the caller could be expressed. Clerk's Firebase
 * integration, which used to bridge that gap, is deprecated and cannot be
 * enabled on new applications at all.
 *
 * Signing in with Firebase directly makes request.auth.uid real, so
 * firestore.rules works with no token exchange, no backend and no service
 * account key to look after.
 *
 * The hook surface deliberately mirrors the one it replaced (useAuth, useUser,
 * SignedIn, SignedOut) so the twenty-odd call sites only changed an import.
 */
export interface AuthContextValue {
  user: FirebaseUser | null;
  userId: string | null;
  isLoaded: boolean;
  isSignedIn: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (name: string, email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}

/** Kept for parity with the call sites that only wanted the user object. */
export function useUser() {
  const { user, isLoaded } = useAuth();
  return { user, isLoaded, isSignedIn: Boolean(user) };
}

/** Firebase surfaces auth failures as codes; these are the ones users hit. */
export function authErrorMessage(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";

  switch (code) {
    case "auth/invalid-email":
      return "That email address does not look right.";
    case "auth/missing-password":
      return "Enter your password.";
    case "auth/weak-password":
      return "Passwords need to be at least six characters.";
    case "auth/email-already-in-use":
      return "An account already exists for that email. Try signing in instead.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "That email and password do not match an account.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a minute and try again.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "The Google sign-in window closed before finishing.";
    case "auth/popup-blocked":
      return "Your browser blocked the Google sign-in window. Allow pop-ups for this site.";
    case "auth/network-request-failed":
      return "Could not reach the server. Check your connection.";
    case "auth/operation-not-allowed":
      return "That sign-in method is not enabled in the Firebase console.";
    default:
      return "Something went wrong signing you in. Please try again.";
  }
}
