"use client";

import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface AiAssistantButtonProps {
  onClick: () => void;
  isOpen: boolean;
  hasUnread?: boolean;
}

export function AiAssistantButton({
  onClick,
  isOpen,
  hasUnread = false,
}: AiAssistantButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={isOpen ? "Close AI assistant" : "Open AI assistant"}
      className={cn(
        "fixed bottom-6 right-6 z-50",
        "flex items-center justify-center w-14 h-14 rounded-full",
        "bg-linear-to-br from-indigo-500 to-violet-600",
        "text-white shadow-2xl shadow-indigo-500/40",
        "hover:scale-110 active:scale-95",
        "transition-all duration-200",
        isOpen && "scale-0 opacity-0 pointer-events-none"
      )}
    >
      <Sparkles className="w-6 h-6" />

      {hasUnread && (
        <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 border-2 border-slate-950 animate-pulse" />
      )}

      {/* Pulse ring */}
      <span className="absolute inset-0 rounded-full bg-indigo-500/30 animate-ping" />
    </button>
  );
}