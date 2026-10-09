import { Suspense } from "react";
import { ErrorContent } from "./error-content";

export default function AuthErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-950">
          <div className="text-slate-500 text-sm">Loading…</div>
        </div>
      }
    >
      <ErrorContent />
    </Suspense>
  );
}