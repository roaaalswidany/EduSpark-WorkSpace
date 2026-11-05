"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Paperclip,
  Upload,
  Loader2,
  FileText,
  Trash2,
  Download,
  AlertCircle,
} from "lucide-react";
import { requestUploadAction } from "@/actions/storage/upload";
import { confirmUploadAction } from "@/actions/storage/confirm-upload";
import { getAttachmentDownloadUrlAction } from "@/actions/storage/get-download-url";
import { deleteAttachmentAction } from "@/actions/storage/delete-attachment";

export interface AttachmentInfo {
  id: string;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  status: "PENDING" | "CONFIRMED" | "FAILED";
}

interface Props {
  lessonId: string;
  attachments: AttachmentInfo[];
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function LessonAttachments({ lessonId, attachments }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);

    try {
      // 1. Request presigned URL
      const reqRes = await requestUploadAction({
        fileName: file.name,
        mimeType: file.type,
        fileSizeBytes: file.size,
        context: "LESSON",
        contextId: lessonId,
      });

      if (!reqRes.success) {
        const msg =
          reqRes.error === "INVALID_INPUT"
            ? "File type or size not allowed."
            : reqRes.error === "RATE_LIMITED"
            ? "Too many uploads. Wait a moment."
            : reqRes.error === "FORBIDDEN"
            ? "You don't own this course."
            : "Upload failed.";
        setError(msg);
        setUploading(false);
        return;
      }

      // 2. PUT the file directly to S3/MinIO
      const putRes = await fetch(reqRes.uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      if (!putRes.ok) {
        setError("File upload to storage failed.");
        setUploading(false);
        return;
      }

      // 3. Confirm the upload
      const confirmRes = await confirmUploadAction({ attachmentId: reqRes.attachmentId });
      if (!confirmRes.success) {
        setError("Could not confirm the upload.");
        setUploading(false);
        return;
      }

      toast.success("Attachment uploaded");
      router.refresh();
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Try again.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDownload = (attachmentId: string) => {
    startTransition(async () => {
      const res = await getAttachmentDownloadUrlAction({ attachmentId });
      if (res.success) {
        window.open(res.downloadUrl, "_blank");
      } else {
        toast.error("Could not generate download link", {
          description:
            res.error === "RATE_LIMITED"
              ? "Too many downloads. Please wait a few minutes."
              : undefined,
        });
      }
    });
  };

  const handleDelete = (attachmentId: string, fileName: string) => {
    if (!confirm(`Delete "${fileName}"?`)) return;
    startTransition(async () => {
      const res = await deleteAttachmentAction({ attachmentId });
      if (res.success) {
        toast.success("Attachment deleted");
        router.refresh();
      } else {
        toast.error("Could not delete attachment", {
          description:
            res.error === "STORAGE_ERROR"
              ? "Storage is unavailable right now. Please try again later."
              : res.error === "FORBIDDEN"
                ? "This attachment can no longer be deleted."
                : undefined,
        });
      }
    });
  };

  return (
    <div className="rounded-lg bg-slate-950/40 border border-slate-800 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">
          <Paperclip className="w-3 h-3" />
          Attachments ({attachments.length})
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Upload className="w-3 h-3" />
          )}
          {uploading ? "Uploading..." : "Upload"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileChange}
          accept=".pdf,.png,.jpg,.jpeg,.webp,.zip,.docx,.xlsx,.txt"
          className="hidden"
        />
      </div>

      {error && (
        <div className="flex items-center gap-1.5 text-[10px] text-red-400">
          <AlertCircle className="w-3 h-3 shrink-0" /> {error}
        </div>
      )}

      {attachments.length === 0 ? (
        <p className="text-[10px] text-slate-600 py-1">
          No attachments. Max 25 MB per file.
        </p>
      ) : (
        <div className="space-y-1">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded bg-slate-900/60 border border-slate-800/60"
            >
              <FileText className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-slate-300 truncate">{att.fileName}</p>
                <p className="text-[9px] text-slate-600">
                  {formatSize(att.fileSizeBytes)}
                  {att.status !== "CONFIRMED" && (
                    <span className="ml-1 text-amber-500">· {att.status.toLowerCase()}</span>
                  )}
                </p>
              </div>
              {att.status === "CONFIRMED" && (
                <button
                  onClick={() => handleDownload(att.id)}
                  disabled={isPending}
                  className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-800 text-slate-500 hover:text-indigo-400 transition-colors"
                >
                  <Download className="w-3 h-3" />
                </button>
              )}
              <button
                onClick={() => handleDelete(att.id, att.fileName)}
                disabled={isPending}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}