import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authErrorMessage, useAuth } from "@/providers/auth-context";

const GoogleMark = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.9Z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24Z"
    />
    <path
      fill="#FBBC05"
      d="M5.4 14.4a7.2 7.2 0 0 1 0-4.6V6.7H1.4a12 12 0 0 0 0 10.8l4-3.1Z"
    />
    <path
      fill="#EA4335"
      d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.7l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z"
    />
  </svg>
);

export const AuthForm = ({ mode }: { mode: "sign-in" | "sign-up" }) => {
  const isSignUp = mode === "sign-up";
  const { signInWithEmail, signUpWithEmail, signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState<"email" | "google" | null>(null);

  const run = async (kind: "email" | "google", action: () => Promise<void>) => {
    setPending(kind);
    try {
      await action();
      navigate("/generate", { replace: true });
    } catch (error) {
      console.error("Auth failed", error);
      toast.error(isSignUp ? "Could not create your account" : "Could not sign you in", {
        description: authErrorMessage(error),
      });
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-balance text-2xl font-semibold tracking-tight">
          {isSignUp ? "Create your account" : "Sign in"}
        </h1>
        <p className="text-pretty text-sm text-ink-muted">
          {isSignUp
            ? "You need an account so your interviews and feedback are saved between sessions."
            : "Pick up where you left off."}
        </p>
      </div>

      <Button
        type="button"
        variant="secondary"
        size="lg"
        disabled={pending !== null}
        onClick={() => run("google", signInWithGoogle)}
      >
        {pending === "google" ? (
          <Loader className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <span className="mr-2">
            <GoogleMark />
          </span>
        )}
        Continue with Google
      </Button>

      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-ink-faint">or</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          run("email", () =>
            isSignUp
              ? signUpWithEmail(name, email, password)
              : signInWithEmail(email, password)
          );
        }}
      >
        {isSignUp && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            required
            minLength={6}
            autoComplete={isSignUp ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isSignUp ? "At least 6 characters" : "Your password"}
          />
        </div>

        <Button type="submit" size="lg" disabled={pending !== null}>
          {pending === "email" && (
            <Loader className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
          )}
          {isSignUp ? "Create account" : "Sign in"}
        </Button>
      </form>

      <p className="text-sm text-ink-muted">
        {isSignUp ? "Already have an account? " : "No account yet? "}
        <Link
          to={isSignUp ? "/signin" : "/signup"}
          className="font-medium text-ink underline underline-offset-4"
        >
          {isSignUp ? "Sign in" : "Create one"}
        </Link>
      </p>
    </div>
  );
};
