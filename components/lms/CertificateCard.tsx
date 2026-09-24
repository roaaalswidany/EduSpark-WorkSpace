/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useState, useRef, useCallback, useId } from "react";
import {
  Award,
  Copy,
  Check,
  Download,
  ExternalLink,
  Star,
  Calendar,
  Hash,
  GraduationCap,
  Shield,
  Sparkles,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CourseLevel } from "@prisma/client";

// ─── Public Types ─────────────────────────────────────────────────────────────

export interface CertificateDisplayData {
  id: string;
  credentialId: string;
  score: number;
  issuedAt: Date | string;
  courseId: string;
  courseTitle: string;
  courseSlug: string;
  courseLevel: CourseLevel;
  categoryName: string | null;
  recipientName: string;
  instructorName: string;
}

export interface CertificateCardProps {
  certificate: CertificateDisplayData;
  className?: string;
  variant?: "full" | "compact";
  verifyBaseUrl?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreToGrade(score: number): {
  label: string;
  colorClass: string;
} {
  if (score >= 95) return { label: "With Distinction", colorClass: "text-amber-300" };
  if (score >= 85) return { label: "With Merit", colorClass: "text-yellow-400" };
  return { label: "Pass", colorClass: "text-emerald-400" };
}

function formatIssueDate(raw: Date | string): string {
  return new Date(raw).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatLevel(level: CourseLevel): string {
  return level.charAt(0) + level.slice(1).toLowerCase();
}

// ─── Download Utilities ───────────────────────────────────────────────────────

function downloadJsonMetadata(
  cert: CertificateDisplayData,
  verifyUrl: string
): void {
  const metadata = {
    schema_version: "1.0",
    credential_id: cert.credentialId,
    issued_by: "EduSpark Learning Platform",
    issued_at: new Date(cert.issuedAt).toISOString(),
    recipient: {
      name: cert.recipientName,
    },
    achievement: {
      course_title: cert.courseTitle,
      course_level: cert.courseLevel,
      category: cert.categoryName,
      score_percent: cert.score,
      grade: scoreToGrade(cert.score).label,
      instructor: cert.instructorName,
    },
    verification: {
      verify_url: verifyUrl,
      method: "Public credential lookup",
    },
  };

  const blob = new Blob([JSON.stringify(metadata, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `eduspark-certificate-${cert.credentialId}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

// ─── Decorative SVG Seal ─────────────────────────────────────────────────────

function CertificateSeal({ score }: { score: number }) {
  return (
    <div className="relative flex items-center justify-center">
      {/* Outer ring */}
      <svg
        width="80"
        height="80"
        viewBox="0 0 80 80"
        className="absolute"
        aria-hidden
      >
        <circle
          cx="40"
          cy="40"
          r="36"
          fill="none"
          stroke="url(#sealGrad)"
          strokeWidth="1.5"
          strokeDasharray="4 2"
        />
        <defs>
          <linearGradient id="sealGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgb(251 191 36)" />
            <stop offset="50%" stopColor="rgb(253 224 71)" />
            <stop offset="100%" stopColor="rgb(245 158 11)" />
          </linearGradient>
        </defs>
      </svg>

      {/* Inner filled circle */}
      <div className="w-16 h-16 rounded-full bg-linear-to-br from-amber-400 via-yellow-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/40">
        <Award className="w-8 h-8 text-white drop-shadow" />
      </div>
    </div>
  );
}

// ─── Score Badge ──────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  const grade = scoreToGrade(score);
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/25 shadow-inner">
        <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
        <span className="text-lg font-black text-amber-300 tabular-nums leading-none">
          {score}%
        </span>
      </div>
      <span className={cn("text-[10px] font-bold uppercase tracking-widest", grade.colorClass)}>
        {grade.label}
      </span>
    </div>
  );
}

// ─── Full Variant ─────────────────────────────────────────────────────────────

function FullCard({
  certificate,
  verifyUrl,
}: {
  certificate: CertificateDisplayData;
  verifyUrl: string;
}) {
  const [credentialCopied, setCredentialCopied] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);

  const handleCopyCredential = useCallback(async () => {
    await navigator.clipboard.writeText(certificate.credentialId);
    setCredentialCopied(true);
    setTimeout(() => setCredentialCopied(false), 2200);
  }, [certificate.credentialId]);

  const handleCopyVerifyUrl = useCallback(async () => {
    await navigator.clipboard.writeText(verifyUrl);
    setUrlCopied(true);
    setTimeout(() => setUrlCopied(false), 2200);
  }, [verifyUrl]);

  const handleDownload = useCallback(() => {
    downloadJsonMetadata(certificate, verifyUrl);
  }, [certificate, verifyUrl]);

  return (
    <div className="relative p-px rounded-2xl bg-linear-to-br from-amber-500/40 via-yellow-400/20 to-amber-500/40">
      {/* Card body */}
      <div className="relative rounded-2xl bg-linear-to-br from-slate-950 via-slate-900 to-slate-950 overflow-hidden">
        {/* Background dot grid */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: `radial-gradient(circle, rgb(251 191 36) 1px, transparent 1px)`,
            backgroundSize: "28px 28px",
          }}
        />

        {/* Radial glow top-center */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-48 rounded-full bg-amber-500/10 blur-3xl"
        />

        {/* Top gold accent bar */}
        <div className="h-1 bg-linear-to-r from-amber-700 via-yellow-400 to-amber-700" />

        <div className="relative px-6 sm:px-10 py-8 sm:py-10 space-y-7">
          {/* ── Header row: logo left / score right ────────────────────── */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                <GraduationCap className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-400">
                  EduSpark
                </p>
                <p className="text-[10px] text-slate-600 tracking-wide mt-0.5">
                  Certificate of Completion
                </p>
              </div>
            </div>
            <ScoreBadge score={certificate.score} />
          </div>

          {/* ── Central seal + recipient ─────────────────────────────── */}
          <div className="flex flex-col items-center gap-4 text-center">
            <CertificateSeal score={certificate.score} />

            <div>
              <p className="text-[10px] font-medium text-slate-500 uppercase tracking-[0.2em] mb-1.5">
                This certifies that
              </p>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                {certificate.recipientName}
              </h2>
              <p className="text-[11px] text-slate-500 mt-1">
                has successfully completed
              </p>
            </div>

            {/* Course pill */}
            <div className="inline-flex flex-col items-center gap-1.5 px-5 py-3 rounded-2xl bg-linear-to-br from-indigo-500/10 via-violet-500/8 to-indigo-500/10 border border-indigo-500/20 shadow-inner shadow-indigo-500/5">
              <div className="flex items-center gap-2">
                <BookOpen className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <h3 className="text-base sm:text-lg font-bold text-white leading-snug">
                  {certificate.courseTitle}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {certificate.categoryName && (
                  <>
                    <span className="text-[10px] text-slate-500">
                      {certificate.categoryName}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-slate-700" />
                  </>
                )}
                <span className="text-[10px] text-indigo-400 font-semibold">
                  {formatLevel(certificate.courseLevel)} Level
                </span>
              </div>
            </div>
          </div>

          {/* ── Horizontal rule ──────────────────────────────────────── */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-linear-to-r from-transparent via-slate-800 to-transparent" />
            <Sparkles className="w-3.5 h-3.5 text-amber-500/40" />
            <div className="flex-1 h-px bg-linear-to-r from-transparent via-slate-800 to-transparent" />
          </div>

          {/* ── Meta grid: date + instructor ─────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-slate-800/50 border border-slate-800">
              <Calendar className="w-4 h-4 text-slate-600 shrink-0" />
              <div className="min-w-0">
                <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-600">
                  Issued
                </p>
                <p className="text-xs font-semibold text-slate-300 truncate mt-0.5">
                  {formatIssueDate(certificate.issuedAt)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-slate-800/50 border border-slate-800">
              <Shield className="w-4 h-4 text-slate-600 shrink-0" />
              <div className="min-w-0">
                <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-600">
                  Instructor
                </p>
                <p className="text-xs font-semibold text-slate-300 truncate mt-0.5">
                  {certificate.instructorName}
                </p>
              </div>
            </div>
          </div>

          {/* ── Credential ID row ─────────────────────────────────────── */}
          <div className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/40">
            <Hash className="w-4 h-4 text-slate-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-600 mb-0.5">
                Credential ID
              </p>
              <p className="text-xs font-mono text-slate-400 truncate">
                {certificate.credentialId}
              </p>
            </div>
            <button
              onClick={handleCopyCredential}
              title="Copy Credential ID"
              className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-slate-700 active:scale-95 transition-all shrink-0"
            >
              {credentialCopied ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-slate-500 hover:text-slate-300 transition-colors" />
              )}
            </button>
          </div>

          {/* ── Action buttons ────────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-2">
            {/* Download JSON */}
            <button
              onClick={handleDownload}
              className={cn(
                "flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl text-center",
                "bg-amber-500/8 hover:bg-amber-500/15 border border-amber-500/15 hover:border-amber-500/30",
                "text-amber-400 hover:text-amber-300",
                "active:scale-95 transition-all duration-150"
              )}
              title="Download certificate metadata as JSON"
            >
              <Download className="w-4 h-4" />
              <span className="text-[10px] font-semibold uppercase tracking-wide">
                Download
              </span>
            </button>

            {/* Copy verify link */}
            <button
              onClick={handleCopyVerifyUrl}
              className={cn(
                "flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl text-center",
                "bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-slate-600",
                "text-slate-500 hover:text-slate-300",
                "active:scale-95 transition-all duration-150"
              )}
              title="Copy verification link"
            >
              {urlCopied ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
              <span className="text-[10px] font-semibold uppercase tracking-wide">
                {urlCopied ? "Copied!" : "Share"}
              </span>
            </button>

            {/* Verify externally */}
            <a
              href={verifyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl text-center",
                "bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-slate-600",
                "text-slate-500 hover:text-slate-300",
                "active:scale-95 transition-all duration-150"
              )}
              title="Verify certificate"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="text-[10px] font-semibold uppercase tracking-wide">
                Verify
              </span>
            </a>
          </div>
        </div>

        {/* Bottom rule */}
        <div className="h-px bg-linear-to-r from-transparent via-amber-500/20 to-transparent" />
      </div>
    </div>
  );
}

// ─── Compact Variant (for lists / dashboards) ─────────────────────────────────

function CompactCard({
  certificate,
  verifyUrl,
}: {
  certificate: CertificateDisplayData;
  verifyUrl: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(certificate.credentialId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [certificate.credentialId]);

  const handleDownload = useCallback(() => {
    downloadJsonMetadata(certificate, verifyUrl);
  }, [certificate, verifyUrl]);

  return (
    <div className="relative p-px rounded-xl bg-linear-to-r from-amber-500/25 via-yellow-400/15 to-amber-500/25 group">
      <div className="relative rounded-xl bg-slate-900 overflow-hidden px-4 py-4 flex items-center gap-4">
        {/* Seal */}
        <div className="w-11 h-11 rounded-xl bg-linear-to-br from-amber-400 to-amber-600 flex items-center justify-center shrink-0 shadow-md shadow-amber-500/20">
          <Award className="w-5 h-5 text-white" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-white truncate">
            {certificate.courseTitle}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[10px] text-slate-500">
              {formatIssueDate(certificate.issuedAt)}
            </span>
            <span className="w-1 h-1 rounded-full bg-slate-700" />
            <span className="text-[10px] font-semibold text-amber-400">
              {certificate.score}%
            </span>
          </div>
          <p className="text-[10px] font-mono text-slate-600 truncate mt-0.5">
            {certificate.credentialId}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={handleCopy}
            title="Copy Credential ID"
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-800 transition-colors"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-slate-600 hover:text-slate-400 transition-colors" />
            )}
          </button>
          <button
            onClick={handleDownload}
            title="Download metadata"
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-800 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-600 hover:text-amber-400 transition-colors" />
          </button>
          <a
            href={verifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Verify certificate"
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-800 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5 text-slate-600 hover:text-slate-400 transition-colors" />
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── Public Export ────────────────────────────────────────────────────────────

export function CertificateCard({
  certificate,
  className,
  variant = "full",
  verifyBaseUrl,
}: CertificateCardProps) {
  const resolvedBase =
    verifyBaseUrl ??
    (typeof window !== "undefined" ? window.location.origin : "");

  const verifyUrl = `${resolvedBase}/verify/${certificate.credentialId}`;

  return (
    <div className={cn("w-full", className)}>
      {variant === "full" ? (
        <FullCard certificate={certificate} verifyUrl={verifyUrl} />
      ) : (
        <CompactCard certificate={certificate} verifyUrl={verifyUrl} />
      )}
    </div>
  );
}