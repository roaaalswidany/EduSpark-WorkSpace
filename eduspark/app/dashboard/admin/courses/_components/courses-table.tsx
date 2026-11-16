/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useState, useTransition, useCallback, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { toast } from "sonner";
import {
  Search, X, Loader2, AlertCircle, XCircle, MoreVertical,
  ExternalLink, GraduationCap, Users, BookOpen, CheckCircle2,
  Eye, HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CourseStatus, CourseLevel } from "@prisma/client";
import { updateCourseAction } from "@/actions/admin/update-course";
import { reviewCourseAction } from "@/actions/admin/review-course";

interface CourseRow {
  id: string; title: string; slug: string; thumbnail: string | null;
  status: CourseStatus; level: CourseLevel; price: number; createdAt: string;
  creator: { id: string; name: string; image: string | null };
  category: { id: string; name: string } | null;
  _count: { enrollments: number; sections: number };
}

interface CoursesTableProps {
  courses: CourseRow[];
  statusCounts: { DRAFT: number; PENDING_REVIEW: number; PUBLISHED: number; ARCHIVED: number; };
  initialQuery: string; initialStatus: string; total: number;
  currentPage: number; totalPages: number;
}

const STATUS_BADGE: Record<CourseStatus, string> = {
  PUBLISHED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  DRAFT: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  PENDING_REVIEW: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  ARCHIVED: "bg-accent/50 text-muted-foreground border-border",
};

const STATUS_TOAST: Record<CourseStatus, { title: string; description: string }> = {
  PUBLISHED: { title: "Course published ًںڑ€", description: "The course is now visible in the public catalog." },
  DRAFT: { title: "Moved to draft ًں“Œ", description: "The course is now hidden from students." },
  PENDING_REVIEW: { title: "Submitted for review", description: "The course is waiting for an administrator decision." },
  ARCHIVED: { title: "Course archived ًں—„ï¸ڈ", description: "The course has been archived and is no longer active." },
};

function CourseThumb({ title, thumbnail, size = 44 }: { title: string; thumbnail: string | null; size?: number }) {
  if (thumbnail) {
    return <Image src={thumbnail} alt={title} width={size} height={size} className="rounded-xl object-cover ring-2 ring-slate-800 shrink-0" style={{ width: size, height: size }} />;
  }
  return (
    <div className="rounded-xl flex items-center justify-center bg-linear-to-br from-emerald-500/20 to-emerald-500/20 ring-2 ring-slate-800 shrink-0" style={{ width: size, height: size }}>
      <span className="text-white/60 font-bold" style={{ fontSize: size * 0.4 }}>{title.charAt(0)}</span>
    </div>
  );
}

export function CoursesTable({ courses, statusCounts, initialQuery, initialStatus, total, currentPage, totalPages }: CoursesTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [searchInput, setSearchInput] = useState(initialQuery);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingCourseId, setPendingCourseId] = useState<string | null>(null);
  const [archiveDialog, setArchiveDialog] = useState<{ courseId: string; courseTitle: string; mode: "ARCHIVE" | "REJECT"; } | null>(null);
  const [reasonInput, setReasonInput] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const activeStatus = searchParams.get("status") ?? "";

  const updateURL = useCallback((updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }
    if (!("page" in updates)) params.delete("page");
    startTransition(() => { router.replace(`${pathname}?${params.toString()}`, { scroll: false }); });
  }, [pathname, router, searchParams]);

  const buildPageUrl = useCallback((targetPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (targetPage > 1) params.set("page", String(targetPage));
    else params.delete("page");
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }, [pathname, searchParams]);

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => updateURL({ q: value }), 350);
  };

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);
  const handleStatusFilter = (status: string) => updateURL({ status });

  const executeChangeStatus = (course: CourseRow, status: "DRAFT" | "PUBLISHED" | "ARCHIVED", reason?: string) => {
    setPendingCourseId(course.id);
    const toastId = toast.loading(`Updating to ${status.toLowerCase()}â€¦`);
    startTransition(async () => {
      const result = await updateCourseAction({ courseId: course.id, action: "CHANGE_STATUS", status, reason });
      setPendingCourseId(null);
      if (!result.success) {
        const messages: Record<string, string> = {
          FORBIDDEN: "Only admins can perform this action.",
          NOT_FOUND: "Course not found.",
          INVALID_INPUT: "A valid reason is required to archive a course.",
          CANNOT_PUBLISH_EMPTY_COURSE: "The course has no lessons yet.",
          QUIZ_TOO_SHORT: "The course quiz is below the minimum number of questions.",
        };
        const errorMessage = messages[result.error] ?? "Action failed.";
        setActionError(errorMessage);
        toast.error("Update failed", { id: toastId, description: errorMessage });
        setTimeout(() => setActionError(null), 4000);
        return;
      }
      const toastConfig = STATUS_TOAST[status];
      toast.success(toastConfig.title, { id: toastId, description: toastConfig.description });
      router.refresh();
    });
  };

  const handleChangeStatus = (course: CourseRow, status: "DRAFT" | "PUBLISHED" | "ARCHIVED") => {
    setOpenMenuId(null);
    setActionError(null);
    if (status === "ARCHIVED" && course.status !== "ARCHIVED") {
      setArchiveDialog({ courseId: course.id, courseTitle: course.title, mode: "ARCHIVE" });
      setReasonInput("");
      setReasonError(null);
      return;
    }
    executeChangeStatus(course, status);
  };

  const runReview = (course: CourseRow, decision: "APPROVE" | "REJECT", note?: string) => {
    setPendingCourseId(course.id);
    const toastId = toast.loading(decision === "APPROVE" ? "Approvingâ€¦" : "Sending feedbackâ€¦");
    startTransition(async () => {
      const result = await reviewCourseAction({ courseId: course.id, decision, note });
      setPendingCourseId(null);
      if (!result.success) {
        const messages: Record<string, string> = {
          FORBIDDEN: "Only admins can review courses.",
          INVALID_STATE: "This course is no longer waiting for review.",
          INVALID_INPUT: "A note of at least 10 characters is required.",
          CANNOT_PUBLISH_EMPTY_COURSE: "The course has no lessons yet.",
          QUIZ_TOO_SHORT: "The course quiz is below the minimum number of questions.",
          NOT_FOUND: "Course not found.",
        };
        const errorMessage = messages[result.error] ?? "Action failed.";
        setActionError(errorMessage);
        toast.error("Review failed", { id: toastId, description: errorMessage });
        setTimeout(() => setActionError(null), 4000);
        router.refresh();
        return;
      }
      toast.success(decision === "APPROVE" ? "Course approved ًںڑ€" : "Feedback sent ًں“Œ", {
        id: toastId,
        description: decision === "APPROVE" ? "The course is now public." : "The course is back in draft with your note.",
      });
      router.refresh();
    });
  };

  const handleApprove = (course: CourseRow) => { setOpenMenuId(null); setActionError(null); runReview(course, "APPROVE"); };
  const handleRequestChanges = (course: CourseRow) => {
    setOpenMenuId(null); setActionError(null);
    setArchiveDialog({ courseId: course.id, courseTitle: course.title, mode: "REJECT" });
    setReasonInput(""); setReasonError(null);
  };

  const handleConfirmArchive = () => {
    if (!archiveDialog) return;
    const trimmed = reasonInput.trim();
    if (trimmed.length < 10) { setReasonError("Please provide at least 10 characters explaining the reason."); return; }
    const target = courses.find((c) => c.id === archiveDialog.courseId);
    if (!target) return;
    if (archiveDialog.mode === "REJECT") runReview(target, "REJECT", trimmed);
    else executeChangeStatus(target, "ARCHIVED", trimmed);
    setArchiveDialog(null); setReasonInput(""); setReasonError(null);
  };

  const filters = [
    { value: "", label: "All", count: statusCounts.DRAFT + statusCounts.PENDING_REVIEW + statusCounts.PUBLISHED + statusCounts.ARCHIVED },
    { value: "PENDING_REVIEW", label: "Pending review", count: statusCounts.PENDING_REVIEW },
    { value: "PUBLISHED", label: "Published", count: statusCounts.PUBLISHED },
    { value: "DRAFT", label: "Draft", count: statusCounts.DRAFT },
    { value: "ARCHIVED", label: "Archived", count: statusCounts.ARCHIVED },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" value={searchInput} onChange={(e) => handleSearchChange(e.target.value)} placeholder="Search by title or descriptionâ€¦" className={cn("w-full h-11 pl-10 pr-10 rounded-xl", "bg-card border border-border text-foreground", "placeholder:text-muted-foreground/70", "focus:outline-none focus:border-primary focus:ring-1 focus:ring-emerald-500")} />
          {isPending && <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-primary animate-spin" />}
          {!isPending && searchInput && <button type="button" onClick={() => handleSearchChange("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>}
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {filters.map((f) => {
            const active = activeStatus === f.value;
            return (
              <button key={f.value} type="button" onClick={() => handleStatusFilter(f.value)} className={cn("shrink-0 px-3.5 py-2 rounded-full text-xs font-bold border transition-all", active ? "bg-primary/10 text-primary border-primary/30" : "bg-card text-muted-foreground border-border hover:border-border hover:text-foreground")}>{f.label} ({f.count})</button>
            );
          })}
        </div>
      </div>

      {total > 0 && <p className="text-xs text-muted-foreground">Showing {courses.length > 0 ? (currentPage - 1) * 20 + 1 : 0}â€“{Math.min(currentPage * 20, total)} of {total}{totalPages > 1 && <span className="text-muted-foreground/70 ml-2">آ· Page {currentPage} of {totalPages}</span>}</p>}

      {actionError && <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/5 border border-destructive/20"><AlertCircle className="w-4 h-4 text-destructive shrink-0" /><p className="text-sm text-destructive">{actionError}</p></div>}

      {courses.length === 0 ? (
        <div className="rounded-2xl bg-card border border-border p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-accent border border-border flex items-center justify-center mx-auto mb-5"><GraduationCap className="w-7 h-7 text-muted-foreground/70" /></div>
          <h2 className="text-lg font-bold text-white mb-1.5">No courses found</h2>
          <p className="text-sm text-muted-foreground">Try adjusting your search or filters.</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-card border border-border overflow-visible">
          <div className="hidden lg:grid grid-cols-[2.5fr_1.5fr_1fr_0.7fr_auto] gap-4 px-5 py-3 border-b border-border bg-card/60 rounded-t-2xl">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Course</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Creator</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Stats</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Status</span>
            <span className="w-8" />
          </div>
          <div className="divide-y divide-border">
            {courses.map((c, idx) => {
              const isPendingCourse = pendingCourseId === c.id;
              const isLastRow = idx === courses.length - 1;
              return (
                <div key={c.id} className="relative grid grid-cols-1 lg:grid-cols-[2.5fr_1.5fr_1fr_0.7fr_auto] gap-3 lg:gap-4 px-5 py-4 lg:items-center hover:bg-accent/40 transition-colors">
                  <div className="flex items-center gap-3 min-w-0 pr-12 lg:pr-0">
                    <CourseThumb title={c.title} thumbnail={c.thumbnail} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{c.title}</p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{c.category?.name ?? "Uncategorized"} آ· {c.level.toLowerCase()} آ· ${c.price.toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="flex lg:block"><span className="lg:hidden text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 mr-2 self-center">Creator:</span><Link href={`/profile/${c.creator.id}`} className="text-xs text-muted-foreground hover:text-primary transition-colors">{c.creator.name}</Link></div>
                  <div className="flex lg:block gap-3 text-xs text-muted-foreground"><span className="lg:hidden text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 mr-2 self-center">Stats:</span><span className="inline-flex items-center gap-1"><Users className="w-3 h-3" />{c._count.enrollments}</span><span className="inline-flex items-center gap-1 ml-2"><BookOpen className="w-3 h-3" />{c._count.sections}</span></div>
                  <div className="flex lg:block"><span className="lg:hidden text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 mr-2 self-center">Status:</span><span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border", STATUS_BADGE[c.status])}>{c.status.replace("_", " ")}</span></div>
                  <div className="absolute top-4 right-4 lg:static lg:justify-self-end">
                    {isPendingCourse ? <Loader2 className="w-4 h-4 text-primary animate-spin" /> : (
                      <button type="button" onClick={() => setOpenMenuId(openMenuId === c.id ? null : c.id)} className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-accent text-muted-foreground hover:text-white transition-colors" aria-label="Course actions"><MoreVertical className="w-4 h-4" /></button>
                    )}
                    {openMenuId === c.id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                        <div className={cn("absolute right-0 w-56 rounded-xl bg-card border border-border shadow-2xl shadow-black/60 overflow-hidden z-20", "animate-slide-down", isLastRow ? "bottom-full mb-1 origin-bottom-right" : "top-full mt-1 origin-top-right")}>
                          {c.status === "PENDING_REVIEW" && (
                            <>
                              <div className="px-3 py-2 border-b border-border"><p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Review</p></div>
                              <Link href={`/dashboard/creator/courses/${c.id}/edit`} target="_blank" className="flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-foreground hover:bg-accent hover:text-white transition-colors">
                                <Eye className="w-3.5 h-3.5" /> Review Content &amp; Lessons
                              </Link>
                              <Link href={`/dashboard/creator/courses/${c.id}/quiz`} target="_blank" className="flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-foreground hover:bg-accent hover:text-white transition-colors">
                                <HelpCircle className="w-3.5 h-3.5" /> Review Quiz ({c._count.sections} sections)
                              </Link>
                              <div className="h-px bg-accent" />
                            </>
                          )}
                          <a href={`/courses/${c.slug}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-foreground hover:bg-accent hover:text-white transition-colors"><ExternalLink className="w-3.5 h-3.5" />View Public</a>
                          <div className="h-px bg-accent" />
                          <div className="px-3 py-2 border-b border-border"><p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Actions</p></div>
                          {c.status === "PENDING_REVIEW" && (
                            <>
                              <button type="button" onClick={() => handleApprove(c)} className="w-full text-left px-3.5 py-2 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 transition-colors inline-flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5" />Approve &amp; publish</button>
                              <button type="button" onClick={() => handleRequestChanges(c)} className="w-full text-left px-3.5 py-2 text-xs font-semibold text-amber-400 hover:bg-amber-500/10 hover:text-amber-300 transition-colors">Request changesâ€¦</button>
                              <div className="h-px bg-accent" />
                            </>
                          )}
                          <button type="button" onClick={() => handleChangeStatus(c, "PUBLISHED")} disabled={c.status === "PUBLISHED" || c.status === "PENDING_REVIEW"} className="w-full text-left px-3.5 py-2 text-xs text-foreground hover:bg-accent hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed">Publish</button>
                          <button type="button" onClick={() => handleChangeStatus(c, "DRAFT")} disabled={c.status === "DRAFT" || c.status === "PENDING_REVIEW"} className="w-full text-left px-3.5 py-2 text-xs text-foreground hover:bg-accent hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed">Set as Draft</button>
                          <button type="button" onClick={() => handleChangeStatus(c, "ARCHIVED")} disabled={c.status === "ARCHIVED"} className="w-full text-left px-3.5 py-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-40 disabled:cursor-not-allowed">Archive</button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          {currentPage > 1 && <Link href={buildPageUrl(currentPage - 1)} className="px-4 py-2 rounded-lg bg-card border border-border hover:border-border text-foreground text-xs font-semibold transition-colors">â†گ Previous</Link>}
          {Array.from({ length: totalPages }).map((_, i) => {
            const p = i + 1;
            if (p === 1 || p === totalPages || (p >= currentPage - 1 && p <= currentPage + 1)) {
              return <Link key={p} href={buildPageUrl(p)} className={cn("w-9 h-9 flex items-center justify-center rounded-lg text-xs font-semibold transition-colors", p === currentPage ? "bg-primary text-primary-foreground font-bold" : "bg-card border border-border hover:border-border text-muted-foreground hover:text-foreground")}>{p}</Link>;
            }
            if (p === currentPage - 2 || p === currentPage + 2) return <span key={p} className="text-muted-foreground/70 text-xs">â€¦</span>;
            return null;
          })}
          {currentPage < totalPages && <Link href={buildPageUrl(currentPage + 1)} className="px-4 py-2 rounded-lg bg-card border border-border hover:border-border text-foreground text-xs font-semibold transition-colors">Next â†’</Link>}
        </div>
      )}

      {archiveDialog && (
        <>
          <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" onClick={() => { setArchiveDialog(null); setReasonInput(""); setReasonError(null); }} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div className="w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl p-5 space-y-4 pointer-events-auto">
              <div>
                <div className="flex items-center gap-2 mb-1"><XCircle className="w-5 h-5 text-destructive" /><h3 className="text-lg font-bold text-white">{archiveDialog.mode === "REJECT" ? "Request changes" : "Archive course"}</h3></div>
                <p className="text-sm text-muted-foreground">{archiveDialog.mode === "REJECT" ? "Tell the creator what must change before" : "Please provide a reason for archiving"} <strong className="text-foreground">&quot;{archiveDialog.courseTitle}&quot;</strong>{archiveDialog.mode === "REJECT" ? " can be published." : ". This reason will be sent to the course creator by email."}</p>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Reason (required)</label>
                <textarea value={reasonInput} onChange={(e) => { setReasonInput(e.target.value); setReasonError(null); }} rows={4} autoFocus maxLength={500} className={cn("w-full bg-background border rounded-lg px-3 py-2 text-sm text-foreground resize-none", "focus:outline-none", reasonError ? "border-destructive" : "border-border focus:border-primary")} placeholder="e.g., Content violates platform quality guidelines." />
                {reasonError && <p className="text-xs text-destructive mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{reasonError}</p>}
                <p className="text-xs text-muted-foreground/70 mt-1.5">{reasonInput.trim().length}/500 characters (minimum 10)</p>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => { setArchiveDialog(null); setReasonInput(""); setReasonError(null); }} disabled={isPending} className="px-4 py-2 rounded-lg bg-accent hover:bg-accent text-foreground text-sm font-semibold transition-colors disabled:opacity-50">Cancel</button>
                <button type="button" onClick={handleConfirmArchive} disabled={isPending || reasonInput.trim().length < 10} className="px-4 py-2 rounded-lg bg-destructive hover:bg-destructive text-destructive-foreground text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2">
                  {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                  {archiveDialog.mode === "REJECT" ? "Send feedback" : "Archive course"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}