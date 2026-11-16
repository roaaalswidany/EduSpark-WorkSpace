import Link from "next/link";
import { ShieldX } from "lucide-react";

export function CertificateNotFound() {
  return (
    <div className="min-h-[70vh] bg-background flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 border border-destructive/20">
          <ShieldX className="h-7 w-7 text-destructive" />
        </div>
        <h1 className="text-xl font-semibold text-slate-100">Certificate not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          No certificate matches this credential ID. Check for typing mistakes, or ask the holder
          to share the link again. Only certificates issued by EduSpark can be verified here.
        </p>
        <p className="mt-1 text-sm text-muted-foreground" dir="rtl">
          ظ„ط§ طھظˆط¬ط¯ ط´ظ‡ط§ط¯ط© ظ…ط·ط§ط¨ظ‚ط© ظ„ظ‡ط°ط§ ط§ظ„ظ…ط¹ط±ظ‘ظپ.
        </p>
        <Link href="/" className="mt-6 inline-block text-sm text-primary hover:text-primary">
          Back to EduSpark
        </Link>
      </div>
    </div>
  );
}
