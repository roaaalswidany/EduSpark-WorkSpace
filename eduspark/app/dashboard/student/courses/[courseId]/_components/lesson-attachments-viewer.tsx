"use client";

import { useState, useTransition } from "react";
import {
  Paperclip,
  Download,
  FileText,
  Loader2,
  Image as ImageIcon,
  FileArchive,
  FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";
import { getAttachmentDownloadUrlAction } from "@/actions/storage/get-download-url";

interface Attachment {
  id: string;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
}

interface Props {
  attachments: Attachment[];
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return ImageIcon;
  if (mimeType === "application/pdf") return FileText;
  if (mimeType === "application/zip") return FileArchive;
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel"))
    return FileSpreadsheet;
  return FileText;
}

export function LessonAttachmentsViewer({ attachments }: Props) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (attachments.length === 0) return null;

  const handleDownload = (attachmentId: string) => {
    setDownloadingId(attachmentId);
    startTransition(async () => {
      const res = await getAttachmentDownloadUrlAction({ attachmentId });
      setDownloadingId(null);
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

  return (
    <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-5">
      <div className="flex items-center gap-2 mb-3">
        <Paperclip className="w-4 h-4 text-indigo-400" />
        <h3 className="text-sm font-bold text-white">
          Lesson Materials ({attachments.length})
        </h3>
      </div>
      <div className="space-y-2">
        {attachments.map((att) => {
          const Icon = getFileIcon(att.mimeType);
          const isDownloading = downloadingId === att.id;
          return (
            <button
              key={att.id}
              onClick={() => handleDownload(att.id)}
              disabled={isPending}
              className="w-full flex items-center gap-3 p-3 rounded-lg bg-slate-950/50 border border-slate-800 hover:border-indigo-500/40 hover:bg-slate-950 transition-colors group"
            >
              <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm text-slate-200 truncate group-hover:text-indigo-300 transition-colors">
                  {att.fileName}
                </p>
                <p className="text-[10px] text-slate-500">
                  {formatSize(att.fileSizeBytes)}
                </p>
              </div>
              {isDownloading ? (
                <Loader2 className="w-4 h-4 text-indigo-400 animate-spin shrink-0" />
              ) : (
                <Download className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 transition-colors shrink-0" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}