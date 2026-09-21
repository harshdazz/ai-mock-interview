import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button, buttonVariants } from "@/components/ui/button";
import type { VariantProps } from "class-variance-authority";
import { Loader } from "lucide-react";
import { cn } from "@/lib/utils";

// Derived from the Button's own cva config rather than hand-listed, so adding
// a variant there cannot leave this union silently out of date.
type ButtonVariant = VariantProps<typeof buttonVariants>["variant"];

interface TooltipButtonProps {
  content: string;
  icon: React.ReactNode;
  onClick: () => void;
  buttonVariant?: ButtonVariant;
  buttonClassName?: string;
  delay?: number;
  disabled?: boolean;
  loading?: boolean;
}

export const TooltipButton = ({
  content,
  icon,
  onClick,
  buttonVariant = "ghost",
  buttonClassName = "",
  delay = 0,
  disabled = false,
  loading = false,
}: TooltipButtonProps) => {
  return (
    <TooltipProvider delayDuration={delay}>
      <Tooltip>
        {/*
          asChild makes the trigger merge its props onto the Button instead of
          rendering its own <button>. Without it the DOM nests one button
          inside another, which is invalid HTML and gives assistive technology
          two overlapping controls for one action.
        */}
        <TooltipTrigger asChild>
          <Button
            size={"icon"}
            disabled={disabled}
            variant={buttonVariant}
            className={cn(
              disabled ? "cursor-not-allowed" : "cursor-pointer",
              buttonClassName
            )}
            onClick={onClick}
          >
            {loading ? (
              <Loader className="min-w-4 min-h-4 animate-spin text-success" />
            ) : (
              icon
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{loading ? "Loading..." : content}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};