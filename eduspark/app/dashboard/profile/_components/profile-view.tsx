"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Pencil,
  X,
  Save,
  Loader2,
  AlertCircle,
  User,
  FileText,
  Globe,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Role } from "@prisma/client";
import { updateProfileAction } from "@/actions/profile/update-profile";
import { ProfileHeader } from "./profile-header";

interface ProfileViewProps {
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
    role: Role;
    headline: string;
    bio: string;
    website: string;
    createdAt: string;
  };
  stats: {
    enrollments: number;
    certificates: number;
    services: number;
    projects: number;
  };
}

interface FormState {
  name: string;
  headline: string;
  bio: string;
  website: string;
}

export function ProfileView({ user, stats }: ProfileViewProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>({
    name: user.name,
    headline: user.headline,
    bio: user.bio,
    website: user.website,
  });

  const handleCancel = () => {
    setForm({
      name: user.name,
      headline: user.headline,
      bio: user.bio,
      website: user.website,
    });
    setServerError(null);
    setIsEditing(false);
  };

  const handleSave = () => {
    setServerError(null);

    const toastId = toast.loading("Saving profile…");

    startTransition(async () => {
      const result = await updateProfileAction({
        name: form.name,
        headline: form.headline,
        bio: form.bio,
        website: form.website,
      });

      if (!result.success) {
        const errorMessage =
          result.error === "INVALID_INPUT"
            ? "Please check the fields and try again."
            : "Something went wrong. Please try again.";

        setServerError(errorMessage);
        toast.error(errorMessage, { id: toastId });
        return;
      }

      toast.success("Profile updated successfully! ✨", { id: toastId });
      setIsEditing(false);
      router.refresh();
    });
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6">
      {/* Header card (view mode) */}
      {!isEditing && <ProfileHeader user={user} stats={stats} />}

      {/* Edit toggle */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          {isEditing ? "Edit Profile" : "About"}
        </h2>

        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            className={cn(
              "inline-flex items-center gap-2 px-4 py-2 rounded-lg",
              "bg-slate-800 hover:bg-slate-700 text-slate-200",
              "text-xs font-semibold border border-slate-700",
              "transition-all active:scale-95"
            )}
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit Profile
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={handleCancel}
              disabled={isPending}
              className={cn(
                "inline-flex items-center gap-2 px-4 py-2 rounded-lg",
                "bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200",
                "text-xs font-semibold border border-slate-700",
                "transition-all active:scale-95 disabled:opacity-50"
              )}
            >
              <X className="w-3.5 h-3.5" />
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isPending}
              className={cn(
                "inline-flex items-center gap-2 px-4 py-2 rounded-lg",
                "bg-indigo-600 hover:bg-indigo-500 text-white",
                "text-xs font-bold",
                "transition-all active:scale-95 disabled:opacity-50",
                "shadow-lg shadow-indigo-500/20"
              )}
            >
              {isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* View mode */}
      {!isEditing && (
        <div className="space-y-4">
          <Section title="Bio" icon={FileText}>
            {user.bio ? (
              <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                {user.bio}
              </p>
            ) : (
              <p className="text-sm text-slate-600 italic">
                No bio added yet. Click &quot;Edit Profile&quot; to add one.
              </p>
            )}
          </Section>

          <Section title="Website" icon={Globe}>
            {user.website ? (
              <a
                href={user.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors break-all"
              >
                {user.website}
              </a>
            ) : (
              <p className="text-sm text-slate-600 italic">
                No website added yet.
              </p>
            )}
          </Section>
        </div>
      )}

      {/* Edit mode */}
      {isEditing && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 sm:p-8 space-y-6">
          <Field
            label="Full Name"
            required
            icon={User}
            hint={`${form.name.length}/60`}
          >
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              disabled={isPending}
              maxLength={60}
              className="w-full h-11 px-3 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 transition-all"
            />
          </Field>

          <Field
            label="Headline"
            icon={Sparkles}
            hint={`${form.headline.length}/100`}
          >
            <input
              type="text"
              value={form.headline}
              onChange={(e) => setForm({ ...form, headline: e.target.value })}
              disabled={isPending}
              maxLength={100}
              placeholder="e.g. Senior Full-Stack Developer"
              className="w-full h-11 px-3 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 transition-all"
            />
          </Field>

          <Field
            label="Bio"
            icon={FileText}
            hint={`${form.bio.length}/500`}
          >
            <textarea
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              disabled={isPending}
              maxLength={500}
              rows={5}
              placeholder="Tell others about yourself, your expertise, and what you do…"
              className="w-full px-3 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none disabled:opacity-50 transition-all"
            />
          </Field>

          <Field label="Website" icon={Globe} hint="Optional">
            <input
              type="url"
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
              disabled={isPending}
              placeholder="https://your-portfolio.com"
              className="w-full h-11 px-3 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 transition-all"
            />
          </Field>

          {serverError && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-500/5 border border-red-500/20">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">{serverError}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 sm:p-6">
      <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
        <Icon className="w-3.5 h-3.5" />
        {title}
      </h3>
      {children}
    </div>
  );
}

function Field({
  label,
  required,
  icon: Icon,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  icon: React.ComponentType<{ className?: string }>;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-300">
          <Icon className="w-3.5 h-3.5 text-slate-500" />
          {label}
          {required && <span className="text-red-400">*</span>}
        </label>
        {hint && (
          <span className="text-[10px] text-slate-600 tabular-nums">
            {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}