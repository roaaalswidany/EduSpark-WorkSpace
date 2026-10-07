/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useState, useTransition, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { toast } from "sonner";
import {
  Search,
  X,
  Loader2,
  AlertCircle,
  MoreVertical,
  ExternalLink,
  GraduationCap,
  Users,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CourseStatus, CourseLevel } from "@prisma/client";
import { updateCourseAction } from "@/actions/admin/update-course";

interface CourseRow {
  id: string;
  title: string;
  slug: string;
  thumbnail: string | null;
  status: CourseStatus;
  level: CourseLevel;
  price: number;
  createdAt: string;
  creator: { id: string; name: string; image: string | null };
  category: { id: string; name: string } | null;
  _count: { enrollments: number; sections: number };
}

interface CoursesTableProps {
  courses: CourseRow[];
  statusCounts: {
    DRAFT: number;
    PUBLISHED: number;
    ARCHIVED: number;
  };
  initialQuery: string;
  initialStatus: string;
}

const STATUS_BADGE: Record<CourseStatus, string> = {
  PUBLISHED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  DRAFT: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  ARCHIVED: "bg-slate-700/50 text-slate-400 border-slate-700",
};

const STATUS_TOAST: Record<
  CourseStatus,
  { title: string; description: string }
> = {
  PUBLISHED: {
    title: "Course published 🚀",
    description: "The course is now visible in the public catalog.",
  },
  DRAFT: {
    title: "Moved to draft 📝",
    description: "The course is now hidden from students.",
  },
  ARCHIVED: {
    title: "Course archived 🗄️",
    description: "The course has been archived and is no longer active.",
  },
};

function CourseThumb({
  title,
  thumbnail,
  size = 44,
}: {
  title: string;
  thumbnail: string | null;
  size?: number;
}) {
  if (thumbnail) {
    return (
      <Image
        src={thumbnail}
        alt={title}
        width={size}
        height={size}
        className="rounded-xl object-cover ring-2 ring-slate-800 shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className="rounded-xl flex items-center justify-center bg-linear-to-br from-indigo-500/20 to-violet-500/20 ring-2 ring-slate-800 shrink-0"
      style={{ width: size, height: size }}
    >
      <span className="text-white/60 font-bold" style={{ fontSize: size * 0.4 }}>
        {title.charAt(0)}
      </span>
    </div>
  );
}

export function CoursesTable({
  courses,
  statusCounts,
  initialQuery,
  initialStatus,
}: CoursesTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [searchInput, setSearchInput] = useState(initialQuery);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingCourseId, setPendingCourseId] = useState<string | null>(null);

  const activeStatus = searchParams.get("status") ?? "";

  const updateURL = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") params.delete(key);
        else params.set(key, value);
      }
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      });
    },
    [pathname, router, searchParams]
  );

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    const timer = setTimeout(() => updateURL({ q: value }), 350);
    return () => clearTimeout(timer);
  };

  const handleStatusFilter = (status: string) => updateURL({ status });

  const handleChangeStatus = (course: CourseRow, status: CourseStatus) => {
    setOpenMenuId(null);
    setActionError(null);
    setPendingCourseId(course.id);

    const toastId = toast.loading(`Updating to ${status.toLowerCase()}…`);

    startTransition(async () => {
      const result = await updateCourseAction({
        courseId: course.id,
        action: "CHANGE_STATUS",
        status,
      });
      setPendingCourseId(null);

      if (!result.success) {
        const errorMessage =
          result.error === "FORBIDDEN"
            ? "Only admins can perform this action."
            : "Action failed.";

        setActionError(errorMessage);
        toast.error("Update failed", {
          id: toastId,
          description: errorMessage,
        });
        setTimeout(() => setActionError(null), 4000);
        return;
      }

      const toastConfig = STATUS_TOAST[status];
      toast.success(toastConfig.title, {
        id: toastId,
        description: toastConfig.description,
      });
      router.refresh();
    });
  };

  const filters = [
    {
      value: "",
      label: "All",
      count:
        statusCounts.DRAFT + statusCounts.PUBLISHED + statusCounts.ARCHIVED,
    },
    { value: "PUBLISHED", label: "Published", count: statusCounts.PUBLISHED },
    { value: "DRAFT", label: "Draft", count: statusCounts.DRAFT },
    { value: "ARCHIVED", label: "Archived", count: statusCounts.ARCHIVED },
  ];

  return (
    <div className="space-y-4">
      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search by title or description…"
            className={cn(
              "w-full h-11 pl-10 pr-10 rounded-xl",
              "bg-slate-900 border border-slate-800 text-slate-200",
              "placeholder:text-slate-600",
              "focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            )}
          />
          {isPending && (
            <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400 animate-spin" />
          )}
          {!isPending && searchInput && (
            <button
              type="button"
              onClick={() => handleSearchChange("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto">
          {filters.map((f) => {
            const active = activeStatus === f.value;
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => handleStatusFilter(f.value)}
                className={cn(
                  "shrink-0 px-3.5 py-2 rounded-full text-xs font-bold border transition-all",
                  active
                    ? "bg-indigo-500/10 text-indigo-300 border-indigo-500/30"
                    : "bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-300"
                )}
              >
                {f.label} ({f.count})
              </button>
            );
          })}
        </div>
      </div>

      {actionError && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/5 border border-red-500/20">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <p className="text-sm text-red-300">{actionError}</p>
        </div>
      )}

      {courses.length === 0 ? (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto mb-5">
            <GraduationCap className="w-7 h-7 text-slate-600" />
          </div>
          <h2 className="text-lg font-bold text-white mb-1.5">
            No courses found
          </h2>
          <p className="text-sm text-slate-500">
            Try adjusting your search or filters.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-visible">
          <div className="hidden lg:grid grid-cols-[2.5fr_1.5fr_1fr_0.7fr_auto] gap-4 px-5 py-3 border-b border-slate-800 bg-slate-900/60 rounded-t-2xl">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Course
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Creator
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Stats
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Status
            </span>
            <span className="w-8" />
          </div>

          <div className="divide-y divide-slate-800">
            {courses.map((c, idx) => {
              const isPendingCourse = pendingCourseId === c.id;
              const isLastRow = idx === courses.length - 1;

              return (
                <div
                  key={c.id}
                  className="grid grid-cols-1 lg:grid-cols-[2.5fr_1.5fr_1fr_0.7fr_auto] gap-3 lg:gap-4 px-5 py-4 lg:items-center hover:bg-slate-800/40 transition-colors"
                >
                  {/* Course */}
                  <div className="flex items-center gap-3 min-w-0">
                    <CourseThumb title={c.title} thumbnail={c.thumbnail} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">
                        {c.title}
                      </p>
                      <p className="text-xs text-slate-500 truncate mt-0.5">
                        {c.category?.name ?? "Uncategorized"} ·{" "}
                        {c.level.toLowerCase()} · ${c.price.toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {/* Creator */}
                  <div className="flex lg:block">
                    <span className="lg:hidden text-[10px] font-bold uppercase tracking-widest text-slate-600 mr-2 self-center">
                      Creator:
                    </span>
                    <Link
                      href={`/profile/${c.creator.id}`}
                      className="text-xs text-slate-400 hover:text-indigo-400 transition-colors"
                    >
                      {c.creator.name}
                    </Link>
                  </div>

                  {/* Stats */}
                  <div className="flex lg:block gap-3 text-xs text-slate-500">
                    <span className="lg:hidden text-[10px] font-bold uppercase tracking-widest text-slate-600 mr-2 self-center">
                      Stats:
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {c._count.enrollments}
                    </span>
                    <span className="inline-flex items-center gap-1 ml-2">
                      <BookOpen className="w-3 h-3" />
                      {c._count.sections}
                    </span>
                  </div>

                  {/* Status */}
                  <div className="flex lg:block">
                    <span className="lg:hidden text-[10px] font-bold uppercase tracking-widest text-slate-600 mr-2 self-center">
                      Status:
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border",
                        STATUS_BADGE[c.status]
                      )}
                    >
                      {c.status}
                    </span>
                  </div>

                  {/* Menu */}
                  <div className="relative lg:justify-self-end">
                    {isPendingCourse ? (
                      <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          setOpenMenuId(openMenuId === c.id ? null : c.id)
                        }
                        className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-white transition-colors"
                        aria-label="Course actions"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    )}

                    {openMenuId === c.id && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setOpenMenuId(null)}
                        />
                        <div
                          className={cn(
                            "absolute right-0 w-52 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl shadow-black/60 overflow-hidden z-20",
                            isLastRow ? "bottom-full mb-1" : "top-full mt-1"
                          )}
                        >
                          <a
                            href={`/courses/${c.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            View Public
                          </a>
                          <div className="h-px bg-slate-800" />
                          <div className="px-3 py-2 border-b border-slate-800">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600">
                              Change status
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleChangeStatus(c, "PUBLISHED")}
                            disabled={c.status === "PUBLISHED"}
                            className="w-full text-left px-3.5 py-2 text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Publish
                          </button>
                          <button
                            type="button"
                            onClick={() => handleChangeStatus(c, "DRAFT")}
                            disabled={c.status === "DRAFT"}
                            className="w-full text-left px-3.5 py-2 text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Set as Draft
                          </button>
                          <button
                            type="button"
                            onClick={() => handleChangeStatus(c, "ARCHIVED")}
                            disabled={c.status === "ARCHIVED"}
                            className="w-full text-left px-3.5 py-2 text-xs text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Archive
                          </button>
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
    </div>
  );
}