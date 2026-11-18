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
  if (score >= 95) return { label: "With Distinction", colorClass: "text-amber-500" };
  if (score >= 85) return { label: "With Merit", colorClass: "text-yellow-500" };
  return { label: "Pass", colorClass: "text-emerald-500" };
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
      {/* Outer spinning ring */}
      <svg
        width="96"
        height="96"
        viewBox="0 0 96 96"
        className="absolute animate-[spin_15s_linear_infinite]"
        aria-hidden
      >
        <circle
          cx="48"
          cy="48"
          r="44"
          fill="none"
          stroke="url(#sealGrad)"
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />
        <defs>
          <linearGradient id="sealGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgb(251 191 36)" />
            <stop offset="50%" stopColor="rgb(253 224 71)" />
            <stop offset="100%" stopColor="rgb(245 158 11)" />
          </linearGradient>
        </defs>
      </svg>

      {/* Inner solid gold circle */}
      <div className="w-20 h-20 rounded-full bg-linear-to-br from-amber-300 via-amber-400 to-amber-600 flex items-center justify-center shadow-[0_0_30px_rgba(245,158,11,0.4)] border-4 border-[#09090b]">
        <Award className="w-10 h-10 text-zinc-950 drop-shadow-md" />
      </div>
    </div>
  );
}

// ─── Score Badge (FIXED: Solid Gold with Dark Text) ──────────────────────────

function ScoreBadge({ score }: { score: number }) {
  const grade = scoreToGrade(score);
  return (
    <div className="flex flex-col items-end gap-2">
      {/* Solid Gold Pill with Black Text for perfect contrast */}
      <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-linear-to-r from-amber-400 to-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.3)]">
        <Star className="w-4 h-4 text-zinc-950 fill-zinc-950" />
        <span className="text-sm font-black text-zinc-950 tabular-nums leading-none tracking-wide">
          {score}%
        </span>
      </div>
      <span className={cn("text-[10px] font-black uppercase tracking-[0.2em]", grade.colorClass)}>
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
    <div className="relative p-1 rounded-4xl bg-linear-to-br from-amber-500/60 via-zinc-800 to-amber-500/60 shadow-[0_0_40px_rgba(0,0,0,0.5)]">
      {/* Card body */}
      <div className="relative rounded-[calc(2rem-4px)] bg-[#09090b] overflow-hidden">
        
        {/* Background dot grid */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(circle, rgb(251 191 36) 1px, transparent 1px)`,
            backgroundSize: "24px 24px",
          }}
        />

        {/* Radial glow top-center */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-200 h-100 rounded-full bg-amber-500/10 blur-[120px]"
        />

        <div className="relative px-6 sm:px-14 py-10 sm:py-14 space-y-10">
          
          {/* ── Header row: logo left / score right ────────────────────── */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 shadow-inner">
                <GraduationCap className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <p className="text-[12px] font-black uppercase tracking-[0.25em] text-emerald-500">
                  EduSpark
                </p>
                <p className="text-[10px] text-zinc-400 tracking-wide mt-0.5 font-medium uppercase">
                  Certificate of Completion
                </p>
              </div>
            </div>
            <ScoreBadge score={certificate.score} />
          </div>

          {/* ── Central seal + recipient ─────────────────────────────── */}
          <div className="flex flex-col items-center gap-6 text-center pt-2">
            <CertificateSeal score={certificate.score} />

            <div className="space-y-2">
              <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-[0.3em] mb-3">
                This certifies that
              </p>
              <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white drop-shadow-lg">
                {certificate.recipientName}
              </h2>
              <p className="text-[13px] text-zinc-400 mt-2">
                has successfully completed the course
              </p>
            </div>

            {/* Course Title Pill - Emerald theme */}
            <div className="inline-flex flex-col items-center gap-2 px-10 py-5 rounded-3xl bg-linear-to-b from-emerald-500/15 to-emerald-500/5 border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.1)] mt-4">
              <div className="flex items-center gap-3">
                <BookOpen className="w-5 h-5 text-emerald-400 shrink-0" />
                <h3 className="text-xl sm:text-2xl font-bold text-white leading-snug">
                  {certificate.courseTitle}
                </h3>
              </div>
              <div className="flex items-center gap-2 mt-1">
                {certificate.categoryName && (
                  <>
                    <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
                      {certificate.categoryName}
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/50" />
                  </>
                )}
                <span className="text-[11px] text-emerald-400 font-bold uppercase tracking-wider">
                  {formatLevel(certificate.courseLevel)} Level
                </span>
              </div>
            </div>
          </div>

          {/* ── Horizontal rule ──────────────────────────────────────── */}
          <div className="flex items-center gap-4 py-4">
            <div className="flex-1 h-px bg-linear-to-r from-transparent via-zinc-700 to-transparent" />
            <Sparkles className="w-4 h-4 text-amber-500/60" />
            <div className="flex-1 h-px bg-linear-to-r from-transparent via-zinc-700 to-transparent" />
          </div>

          {/* ── Meta grid: date + instructor ─────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/3 border border-white/10">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                <Calendar className="w-5 h-5 text-zinc-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">
                  Issued
                </p>
                <p className="text-sm font-semibold text-zinc-200 truncate mt-0.5">
                  {formatIssueDate(certificate.issuedAt)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/3 border border-white/10">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5 text-zinc-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">
                  Instructor
                </p>
                <p className="text-sm font-semibold text-zinc-200 truncate mt-0.5">
                  {certificate.instructorName}
                </p>
              </div>
            </div>
          </div>

          {/* ── Credential ID row ─────────────────────────────────────── */}
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/3 border border-white/10">
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
              <Hash className="w-5 h-5 text-zinc-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500 mb-0.5">
                Credential ID
              </p>
              <p className="text-xs font-mono text-zinc-300 truncate tracking-wider">
                {certificate.credentialId}
              </p>
            </div>
            <button
              onClick={handleCopyCredential}
              title="Copy Credential ID"
              className="flex items-center justify-center w-9 h-9 rounded-xl hover:bg-white/10 active:scale-95 transition-all shrink-0 text-zinc-400 hover:text-foreground"
            >
              {credentialCopied ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* ── Action buttons ────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4">
            {/* Download JSON - Solid Gold */}
            <button
              onClick={handleDownload}
              className={cn(
                "flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl",
                "bg-amber-500 hover:bg-amber-400 text-zinc-950",
                "shadow-[0_0_20px_rgba(245,158,11,0.2)] hover:shadow-[0_0_25px_rgba(245,158,11,0.4)]",
                "active:scale-95 transition-all duration-200"
              )}
              title="Download certificate metadata as JSON"
            >
              <Download className="w-4 h-4" />
              <span className="text-xs font-black uppercase tracking-wider">
                Download
              </span>
            </button>

            {/* Copy verify link - Glass */}
            <button
              onClick={handleCopyVerifyUrl}
              className={cn(
                "flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl",
                "bg-white/5 hover:bg-white/10 border border-white/10",
                "text-zinc-300 hover:text-white",
                "active:scale-95 transition-all duration-200"
              )}
              title="Copy verification link"
            >
              {urlCopied ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
              <span className="text-xs font-bold uppercase tracking-wider">
                {urlCopied ? "Copied!" : "Share"}
              </span>
            </button>

            {/* Verify externally - Glass */}
            <a
              href={verifyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl",
                "bg-white/5 hover:bg-white/10 border border-white/10",
                "text-zinc-300 hover:text-white",
                "active:scale-95 transition-all duration-200"
              )}
              title="Verify certificate"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">
                Verify
              </span>
            </a>
          </div>
        </div>

        {/* Bottom glow rule */}
        <div className="h-1 bg-linear-to-r from-transparent via-amber-500/50 to-transparent" />
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
    <div className="relative p-px rounded-xl bg-linear-to-r from-amber-500/30 via-yellow-400/20 to-amber-500/30 group">
      <div className="relative rounded-xl bg-[#09090b] overflow-hidden px-4 py-4 flex items-center gap-4">
        {/* Seal */}
        <div className="w-12 h-12 rounded-xl bg-linear-to-br from-amber-400 to-amber-600 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/20">
          <Award className="w-6 h-6 text-zinc-950" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate">
            {certificate.courseTitle}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[11px] text-zinc-400">
              {formatIssueDate(certificate.issuedAt)}
            </span>
            <span className="w-1 h-1 rounded-full bg-zinc-600" />
            <span className="text-[11px] font-bold text-amber-500">
              {certificate.score}%
            </span>
          </div>
          <p className="text-[10px] font-mono text-zinc-500 truncate mt-1">
            {certificate.credentialId}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleCopy}
            title="Copy Credential ID"
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors text-zinc-400 hover:text-foreground"
          >
            {copied ? (
              <Check className="w-4 h-4 text-emerald-400" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={handleDownload}
            title="Download metadata"
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors text-zinc-400 hover:text-amber-400"
          >
            <Download className="w-4 h-4" />
          </button>
          <a
            href={verifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Verify certificate"
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors text-zinc-400 hover:text-foreground"
          >
            <ExternalLink className="w-4 h-4" />
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