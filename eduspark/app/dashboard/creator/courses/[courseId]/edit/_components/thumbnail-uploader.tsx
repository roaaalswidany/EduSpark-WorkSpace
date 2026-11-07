"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Upload, Loader2, Image as ImageIcon, ExternalLink } from "lucide-react";
import { updateCourseThumbnailAction } from "@/actions/creator/update-course-thumbnail";

interface ThumbnailUploaderProps {
  courseId: string;
  currentThumbnail: string | null;
}

const MAX_SIZE = 2 * 1024 * 1024;

export function ThumbnailUploader({
  courseId,
  currentThumbnail,
}: ThumbnailUploaderProps) {
  const [preview, setPreview] = useState<string | null>(currentThumbnail);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      toast.error("Only PNG, JPG, or WebP images are allowed.");
      return;
    }
    if (file.size > MAX_SIZE) {
      toast.error("Maximum file size is 2MB.");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("courseId", courseId);

    const toastId = toast.loading("Uploading thumbnail…");
    startTransition(async () => {
      const res = await updateCourseThumbnailAction(formData);
      if (res.success) {
        toast.success("Thumbnail updated!", { id: toastId });
        setPreview(res.url);
        URL.revokeObjectURL(objectUrl);
      } else {
        const messages: Record<string, string> = {
          INVALID_TYPE: "The file is not a valid PNG, JPG or WebP image.",
          FILE_TOO_LARGE: "Maximum file size is 2MB.",
          COURSE_LOCKED: "The course is under review. Withdraw it to change the image.",
          RATE_LIMITED: "Too many uploads. Please try again later.",
          FORBIDDEN: "You don't have permission to change this image.",
        };
        toast.error("Upload failed", { id: toastId, description: messages[res.error] ?? res.error });
        setPreview(currentThumbnail);
        URL.revokeObjectURL(objectUrl);
      }
    });
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 flex flex-col sm:flex-row items-center gap-5 transition-all hover:border-slate-700">
      {/* Image Preview */}
      <div 
        className="relative w-full sm:w-40 aspect-video rounded-lg overflow-hidden bg-slate-950 border border-slate-800 shrink-0 group cursor-pointer"
        onClick={() => !isPending && inputRef.current?.click()}
      >
        {preview ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Course thumbnail"
              className="w-full h-full object-cover group-hover:opacity-60 transition-opacity"
            />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
               <span className="px-2 py-1 bg-black/70 text-white text-[10px] font-semibold rounded backdrop-blur-sm flex items-center gap-1">
                 <Upload className="w-3 h-3" /> Change
               </span>
            </div>
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 group-hover:text-indigo-400 transition-colors gap-1">
            <ImageIcon className="w-5 h-5" />
            <span className="text-[9px] font-medium uppercase tracking-wider">No Image</span>
          </div>
        )}

        {isPending && (
          <div className="absolute inset-0 bg-slate-950/80 flex items-center justify-center z-10">
            <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 w-full space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              Course Cover Image
              {preview && (
                <a href={preview} target="_blank" rel="noreferrer" className="text-slate-500 hover:text-indigo-400 transition-colors" title="Open in new tab">
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Recommended size: 1280x720 (16:9 aspect ratio).
            </p>
          </div>
          
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isPending}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-semibold disabled:opacity-50 transition-all"
          >
            {isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5" />
            )}
            {preview ? "Replace" : "Upload"}
          </button>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={onChange}
        className="hidden"
      />
    </div>
  );
}