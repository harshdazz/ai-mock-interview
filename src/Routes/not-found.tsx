import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const NotFoundPage = () => {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-mono text-sm text-muted-foreground">404</p>
      <h1 className="text-balance text-3xl font-semibold tracking-tight">
        This page does not exist
      </h1>
      <p className="max-w-[48ch] text-pretty text-muted-foreground">
        The link may be out of date, or the interview may have been deleted.
      </p>
      <Button asChild className="mt-2">
        <Link to="/">Back to home</Link>
      </Button>
    </main>
  );
};

export default NotFoundPage;
