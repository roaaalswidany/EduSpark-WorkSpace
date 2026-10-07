"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
} from "react";
import { useRouter } from "next/navigation";
import {
  X,
  Send,
  Sparkles,
  Plus,
  MessageSquare,
  Trash2,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AiMessageBubble } from "./ai-message-bubble";
import {
  getConversationsAction,
  getConversationMessagesAction,
  deleteConversationAction,
  type AiConversationSummary,
  type AiMessageData,
} from "@/actions/ai/manage-chat";

interface Suggestion {
  label: string;
  href: string;
}

interface AiAssistantPanelProps {
  onClose: () => void;
}

const WELCOME_MESSAGE: AiMessageData = {
  id: "welcome",
  role: "assistant",
  content:
    "أهلاً! 👋 أنا مساعد **EduSpark** الذكي.\n\nكيف يمكنني مساعدتك؟",
  createdAt: new Date().toISOString(),
};

const QUICK_PROMPTS = [
  "📚 اقترح لي كورسات",
  "🎓 كيف أحصل على شهادة؟",
  "🛒 اشرح لي السوق",
  "🎨 كيف أصبح منشئ؟",
];

export function AiAssistantPanel({ onClose }: AiAssistantPanelProps) {
  const router = useRouter();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AiMessageData[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [conversations, setConversations] = useState<AiConversationSummary[]>(
    []
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  // Focus input
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 200);
    return () => clearTimeout(timer);
  }, [conversationId]);

  // Load conversations when showing history
  useEffect(() => {
    if (!showHistory) return;
    void getConversationsAction().then((res) => {
      if (res.success) setConversations(res.data);
    });
  }, [showHistory]);

  // ── Send message ─────────────────────────────────────────────

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      setError(null);
      setSuggestions([]);
      setInput("");
      setIsLoading(true);

      // Optimistic user message
      const optimisticUser: AiMessageData = {
        id: `temp-${Date.now()}`,
        role: "user",
        content: trimmed,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimisticUser]);

      try {
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: trimmed,
            conversationId,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "REQUEST_FAILED");
        }

        const data = await res.json();

        setConversationId(data.conversationId);
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== optimisticUser.id),
          data.userMessage,
          data.assistantMessage,
        ]);
        setSuggestions(data.suggestions ?? []);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message === "UNAUTHORIZED"
              ? "انتهت الجلسة. يرجى تسجيل الدخول مجدداً."
              : "حدث خطأ. يرجى المحاولة مرة أخرى."
            : "حدث خطأ غير متوقع."
        );
        // Remove optimistic message on error
        setMessages((prev) => prev.filter((m) => m.id !== optimisticUser.id));
      } finally {
        setIsLoading(false);
      }
    },
    [conversationId, isLoading]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(input);
    }
  };

  // ── New conversation ─────────────────────────────────────────

  const startNewChat = () => {
    setConversationId(null);
    setMessages([WELCOME_MESSAGE]);
    setSuggestions([]);
    setError(null);
    setShowHistory(false);
  };

  // ── Load conversation ────────────────────────────────────────

  const loadConversation = async (id: string) => {
    setShowHistory(false);
    setError(null);
    setIsLoading(true);

    const res = await getConversationMessagesAction({ conversationId: id });

    if (res.success) {
      setConversationId(id);
      setMessages(
        res.data.messages.length > 0
          ? res.data.messages
          : [WELCOME_MESSAGE]
      );
      setSuggestions([]);
    } else {
      setError("تعذر تحميل المحادثة.");
    }

    setIsLoading(false);
  };

  // ── Delete conversation ──────────────────────────────────────

  const deleteConversation = async (
    e: React.MouseEvent,
    id: string
  ) => {
    e.stopPropagation();
    const res = await deleteConversationAction({ conversationId: id });
    if (res.success) {
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (conversationId === id) startNewChat();
    }
  };

  // ── Handle suggestion click ──────────────────────────────────

  const handleSuggestion = (s: Suggestion) => {
    if (s.href.startsWith("#")) {
      // Internal shortcut
      if (s.href === "#recommend") void sendMessage("اقترح لي كورسات");
      else if (s.href === "#certified")
        void sendMessage("كيف أحصل على شهادة؟");
      return;
    }
    router.push(s.href);
    onClose();
  };

  // ── Render ───────────────────────────────────────────────────

  return (
    <div
      className={cn(
        "fixed bottom-6 right-6 z-50",
        "w-95 max-w-[calc(100vw-3rem)] h-150 max-h-[calc(100vh-6rem)]",
        "rounded-2xl bg-slate-900 border border-slate-800",
        "shadow-2xl shadow-black/60",
        "flex flex-col overflow-hidden",
        "animate-in slide-in-from-bottom-4 fade-in duration-200"
      )}
    >
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-4 h-14 border-b border-slate-800 bg-slate-900/80">
        <div className="w-8 h-8 rounded-lg bg-linear-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white">مساعد EduSpark</p>
          <p className="text-[10px] text-slate-500">
            {showHistory ? "المحادثات السابقة" : "مدعوم بالذكاء الاصطناعي"}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowHistory((v) => !v)}
          title="History"
          className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors"
        >
          <MessageSquare className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={startNewChat}
          title="New chat"
          className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onClose}
          title="Close"
          className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      {showHistory ? (
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <MessageSquare className="w-10 h-10 text-slate-700 mb-3" />
              <p className="text-sm text-slate-500">
                لا توجد محادثات سابقة
              </p>
            </div>
          ) : (
            conversations.map((c) => (
              <div
                key={c.id}
                onClick={() => void loadConversation(c.id)}
                className={cn(
                  "group w-full flex items-center gap-2 p-3 rounded-lg",
                  "hover:bg-slate-800 transition-colors cursor-pointer",
                  conversationId === c.id && "bg-slate-800"
                )}
              >
                <MessageSquare className="w-4 h-4 text-slate-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-200 truncate">
                    {c.title}
                  </p>
                  <p className="text-[10px] text-slate-600 mt-0.5">
                    {c.messageCount} رسالة
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void deleteConversation(e, c.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 flex items-center justify-center w-6 h-6 rounded hover:bg-red-500/10 text-slate-600 hover:text-red-400 transition-all"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))
          )}
        </div>
      ) : (
        <>
          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-4 space-y-4"
          >
            {messages.map((m) => (
              <AiMessageBubble
                key={m.id}
                role={m.role}
                content={m.content}
              />
            ))}

            {isLoading && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                يفكر…
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-xs text-red-300">{error}</p>
              </div>
            )}

            {/* Suggestions */}
            {suggestions.length > 0 && !isLoading && (
              <div className="flex flex-wrap gap-2 pt-1">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSuggestion(s)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium",
                      "bg-indigo-500/10 text-indigo-300 border border-indigo-500/20",
                      "hover:bg-indigo-500/20 hover:text-indigo-200",
                      "transition-colors"
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}

            {/* Quick prompts */}
            {messages.length === 1 && !isLoading && (
              <div className="space-y-2 pt-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600">
                  أسئلة شائعة
                </p>
                <div className="flex flex-wrap gap-2">
                  {QUICK_PROMPTS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => void sendMessage(q)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs",
                        "bg-slate-800 text-slate-300 border border-slate-700",
                        "hover:bg-slate-700 hover:text-white",
                        "transition-colors"
                      )}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={handleSubmit}
            className="shrink-0 p-3 border-t border-slate-800 bg-slate-900/60"
          >
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="اكتب سؤالك…"
                rows={1}
                maxLength={2000}
                disabled={isLoading}
                className={cn(
                  "flex-1 px-3 py-2.5 rounded-xl text-sm",
                  "bg-slate-950 border border-slate-700 text-slate-200",
                  "placeholder:text-slate-600 resize-none",
                  "focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500",
                  "disabled:opacity-50",
                  "max-h-32 overflow-y-auto"
                )}
                style={{ minHeight: "42px" }}
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = "auto";
                  el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
                }}
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className={cn(
                  "shrink-0 flex items-center justify-center w-10 h-10 rounded-xl",
                  "transition-all duration-150 active:scale-95",
                  input.trim() && !isLoading
                    ? "bg-indigo-600 hover:bg-indigo-500 text-white"
                    : "bg-slate-800 text-slate-600 cursor-not-allowed"
                )}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}