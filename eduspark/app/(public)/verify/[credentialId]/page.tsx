import { headers } from "next/headers";
import type { Metadata } from "next";
import { BadgeCheck, CalendarDays, GraduationCap, Trophy } from "lucide-react";
import { getPublicCertificate } from "@/lib/certificates/public";
import { qrSvg } from "@/lib/certificates/qr";
import { publicBaseUrl } from "@/lib/http/public-base-url";
import { checkRateLimit, getClientIdentifier, RateLimits } from "@/lib/security/rate-limit";
import { CertificateNotFound } from "@/components/certificates/certificate-not-found";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Verify certificate · EduSpark",
  // A credential link is shared deliberately by its holder — keep it out of search engines.
  robots: { index: false, follow: false },
};

export default async function VerifyCertificatePage({
  params,
}: {
  params: Promise<{ credentialId: string }>;
}) {
  const { credentialId } = await params;
  const h = await headers();

  const limit = await checkRateLimit(RateLimits.PUBLIC_VERIFY, getClientIdentifier(h));
  if (!limit.allowed) {
    return (
      <div className="min-h-[60vh] bg-slate-950 flex items-center justify-center px-4 text-center text-slate-400">
        Too many verification requests. Please try again in a minute.
      </div>
    );
  }

  const cert = await getPublicCertificate(credentialId);
  // Rendered inline (not notFound()) so the message is present in the server HTML,
  // consistent with the app's other lookup pages. The JSON API returns a real 404.
  if (!cert) return <CertificateNotFound />;

  const verifyUrl = `${publicBaseUrl(h)}/verify/${cert.credentialId}`;
  const qr = await qrSvg(verifyUrl);
  const issued = cert.issuedAt.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      {/* Print only the certificate card */}
      <style>{`@media print {
        body * { visibility: hidden !important; }
        .print-area, .print-area * { visibility: visible !important; }
        .print-area { position: absolute; left: 0; top: 0; width: 100%; background: #fff !important; color: #0f172a !important; border: 2px solid #0f172a !important; }
        .print-area .muted { color: #475569 !important; }
      }`}</style>

      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-emerald-300 print:hidden">
          <BadgeCheck className="h-5 w-5" />
          <span className="text-sm font-semibold">
            Verified — this certificate was issued by EduSpark · شهادة موثّقة صادرة عن EduSpark
          </span>
        </div>

        <article className="print-area rounded-2xl border border-slate-700 bg-slate-900 p-8 sm:p-12">
          <div className="flex items-center gap-2 text-indigo-400">
            <GraduationCap className="h-6 w-6" />
            <span className="text-lg font-bold tracking-wide">EduSpark</span>
          </div>

          <p className="muted mt-8 text-xs uppercase tracking-[0.25em] text-slate-500">Certificate of Competency</p>
          <h1 className="mt-2 text-3xl sm:text-4xl font-bold text-slate-50">{cert.holderName}</h1>
          <p className="muted mt-4 text-slate-400">has demonstrated competency in</p>
          <h2 className="mt-1 text-xl sm:text-2xl font-semibold text-slate-100">{cert.courseTitle}</h2>
          {cert.categoryName && <p className="muted mt-1 text-sm text-slate-500">{cert.categoryName}</p>}

          <dl className="mt-8 grid grid-cols-2 gap-6 text-sm">
            <div>
              <dt className="muted flex items-center gap-1.5 text-slate-500"><Trophy className="h-4 w-4" /> Score</dt>
              <dd className="mt-1 text-lg font-semibold">{cert.score}%</dd>
            </div>
            <div>
              <dt className="muted flex items-center gap-1.5 text-slate-500"><CalendarDays className="h-4 w-4" /> Issued</dt>
              <dd className="mt-1 text-lg font-semibold">{issued}</dd>
            </div>
          </dl>

          <div className="mt-10 flex items-end justify-between gap-6 border-t border-slate-800 pt-6">
            <div className="min-w-0">
              <p className="muted text-xs text-slate-500">Credential ID</p>
              <p className="mt-1 break-all font-mono text-sm">{cert.credentialId}</p>
              <p className="muted mt-3 break-all text-xs text-slate-500">{verifyUrl}</p>
            </div>
            <div
              className="shrink-0 rounded-lg bg-white p-1.5"
              aria-label="QR code linking to this verification page"
              dangerouslySetInnerHTML={{ __html: qr }}
            />
          </div>
        </article>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 print:hidden">
          <p className="text-xs text-slate-500">
            Verification is live: this page reads EduSpark&apos;s records, so a forged document cannot
            produce it.
          </p>
          <PrintButton />
        </div>
      </div>
    </div>
  );
}
