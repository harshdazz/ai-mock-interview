import { Loader, LogOut } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "./button";
import { TooltipButton } from "../tooltip-button";
import { useAuth } from "@/providers/auth-context";

const ProfileContainer = () => {
  const { isSignedIn, isLoaded, user, signOut } = useAuth();

  if (!isLoaded) {
    return (
      <div className="flex items-center" aria-hidden="true">
        <Loader className="h-4 w-4 animate-spin text-ink-faint" />
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <Button asChild size="sm">
        <Link to="/signin">Get started</Link>
      </Button>
    );
  }

  const label = user?.displayName || user?.email || "Your account";
  const initial = label.trim().charAt(0).toUpperCase();

  return (
    <div className="flex items-center gap-2">
      {user?.photoURL ? (
        <img
          src={user.photoURL}
          alt=""
          className="h-8 w-8 rounded-full border object-cover"
        />
      ) : (
        <span
          className="flex h-8 w-8 items-center justify-center rounded-full border bg-surface-2 text-sm font-medium"
          aria-hidden="true"
        >
          {initial}
        </span>
      )}
      <span className="sr-only">Signed in as {label}</span>
      <TooltipButton
        content="Sign out"
        icon={<LogOut className="h-4 w-4" />}
        onClick={async () => {
          try {
            await signOut();
            toast.success("Signed out");
          } catch (error) {
            console.error("Sign out failed", error);
            toast.error("Could not sign you out");
          }
        }}
      />
    </div>
  );
};

export default ProfileContainer;
