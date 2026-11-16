/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, X, Loader2, BookOpen } from "lucide-react";
import { createCourseAction } from "@/actions/creator/create-course";

export function CreateCourseForm() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("0");
  const [level, setLevel] = useState("BEGINNER");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await createCourseAction({
        title,
        description,
        price: Number(price),
        level: level as any,
      });

      if (result.success && result.courseId) {
        toast.success("Course created! ًںژ‰");
        setIsOpen(false);
        router.push(`/dashboard/creator/courses/${result.courseId}/edit`);
      } else {
        toast.error("Could not create course.");
      }
    });
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary text-white text-sm font-bold transition-all shadow-lg shadow-emerald-500/20"
      >
        <Plus className="w-4 h-4" />
        Create Course
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-2xl bg-card border border-border shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            Create New Course
          </h2>
          <button
            onClick={() => setIsOpen(false)}
            className="text-muted-foreground hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Course Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              minLength={3}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-white focus:border-primary outline-none"
              placeholder="e.g. Master React in 30 Days"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              minLength={10}
              rows={3}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-white focus:border-primary outline-none resize-none"
              placeholder="What will students learn?"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Price ($)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-white focus:border-primary outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Level</label>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-white focus:border-primary outline-none"
              >
                <option value="BEGINNER">Beginner</option>
                <option value="INTERMEDIATE">Intermediate</option>
                <option value="ADVANCED">Advanced</option>
              </select>
            </div>
          </div>

          <div className="pt-4 border-t border-border flex justify-end">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary hover:bg-primary text-white text-sm font-bold disabled:opacity-50 transition-all active:scale-95"
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {isPending ? "Creating..." : "Create Course"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}