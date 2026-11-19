import { Suspense } from "react";
import { ErrorContent } from "./error-content";

export default function AuthErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-muted-foreground text-sm">Loading...</div>
        </div>
      }
    >
      <ErrorContent />
    </Suspense>
  );
}