"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, Sparkles } from "lucide-react";

const ERROR_MESSAGES: Record<string, string> = {
  Configuration: "There is a problem with the server configuration.",
  AccessDenied: "You do not have permission to sign in.",
  Verification: "The sign-in link is no longer valid.",
  Default: "An error occurred during sign-in.",
};

export function ErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error") ?? "Default";
  const message = ERROR_MESSAGES[error] ?? ERROR_MESSAGES.Default;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md text-center">
 <Link href="/" className="flex items-center justify-center gap-2.5 mb-7 group">
  <div className="w-10 h-10 rounded-xl bg-linear-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 group-hover:scale-105 transition-transform">
    <Sparkles className="w-5 h-5 text-white" />
  </div>
  <span className="text-xl font-black text-white tracking-tight">
    EduSpark
  </span>
</Link>

<div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
  <AlertCircle className="w-7 h-7 text-red-400" />
</div>
<h1 className="text-2xl font-bold text-white mb-2">
  Authentication Error
</h1>
        <p className="text-slate-400 mb-6">{message}</p>
        <Link
          href="/auth/login"
          className="inline-block px-6 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors"
        >
          Back to sign in
        </Link>
      </div>
    </div>
  );
}