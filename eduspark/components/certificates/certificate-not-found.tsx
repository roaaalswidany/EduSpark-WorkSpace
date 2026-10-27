import Link from "next/link";
import { ShieldX } from "lucide-react";

export function CertificateNotFound() {
  return (
    <div className="min-h-[70vh] bg-slate-950 flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/20">
          <ShieldX className="h-7 w-7 text-red-400" />
        </div>
        <h1 className="text-xl font-semibold text-slate-100">Certificate not found</h1>
        <p className="mt-2 text-sm text-slate-400">
          No certificate matches this credential ID. Check for typing mistakes, or ask the holder
          to share the link again. Only certificates issued by EduSpark can be verified here.
        </p>
        <p className="mt-1 text-sm text-slate-500" dir="rtl">
          لا توجد شهادة مطابقة لهذا المعرّف.
        </p>
        <Link href="/" className="mt-6 inline-block text-sm text-indigo-400 hover:text-indigo-300">
          Back to EduSpark
        </Link>
      </div>
    </div>
  );
}
