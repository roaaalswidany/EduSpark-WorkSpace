import Image from "next/image";
import {
  Mail,
  Calendar,
  Globe,
  ShieldCheck,
  GraduationCap,
  Award,
  Package,
  Briefcase,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Role } from "@prisma/client";

interface ProfileHeaderProps {
  user: {
    name: string;
    email: string;
    image: string | null;
    role: Role;
    headline: string;
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

const ROLE_LABELS: Record<Role, string> = {
  STUDENT: "Student",
  CREATOR: "Verified Creator",
  ADMIN: "Administrator",
};

const ROLE_STYLES: Record<Role, string> = {
  STUDENT: "bg-slate-700/60 text-slate-300 border-slate-600",
  CREATOR: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  ADMIN: "bg-violet-500/10 text-violet-400 border-violet-500/20",
};

function Avatar({
  name,
  image,
  size = 96,
}: {
  name: string;
  image: string | null;
  size?: number;
}) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const hue =
    name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;

  if (image) {
    return (
      <Image
        src={image}
        alt={name}
        width={size}
        height={size}
        className="rounded-3xl object-cover ring-2 ring-slate-800"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className="rounded-3xl flex items-center justify-center text-white font-black ring-2 ring-slate-800 shrink-0"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: `linear-gradient(135deg, hsl(${hue}, 60%, 45%), hsl(${
          (hue + 40) % 360
        }, 65%, 35%))`,
      }}
    >
      {initials}
    </div>
  );
}

export function ProfileHeader({ user, stats }: ProfileHeaderProps) {
  const memberSince = new Date(user.createdAt).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const statItems = [
    {
      label: "Courses",
      value: stats.enrollments,
      icon: GraduationCap,
      color: "text-indigo-400",
    },
    {
      label: "Certificates",
      value: stats.certificates,
      icon: Award,
      color: "text-amber-400",
    },
    {
      label: "Services",
      value: stats.services,
      icon: Package,
      color: "text-emerald-400",
    },
    {
      label: "Projects",
      value: stats.projects,
      icon: Briefcase,
      color: "text-violet-400",
    },
  ];

  return (
    <div className="rounded-3xl bg-slate-900 border border-slate-800 overflow-hidden">
      {/* Cover band */}
      <div className="h-28 sm:h-32 bg-linear-to-br from-indigo-500/20 via-violet-500/10 to-fuchsia-500/10 relative">
        <div
          aria-hidden
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 50%, rgba(99,102,241,0.3), transparent 40%), radial-gradient(circle at 80% 50%, rgba(168,85,247,0.25), transparent 40%)",
          }}
        />
      </div>

      {/* Content */}
      <div className="px-6 sm:px-8 pb-6 sm:pb-8">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-6 -mt-12 sm:-mt-14">
          <Avatar name={user.name} image={user.image} size={96} />

          <div className="flex-1 min-w-0 pt-2 sm:pt-0 sm:pb-1">
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {user.name}
            </h1>
            {user.headline && (
              <p className="text-sm text-indigo-400 mt-1">{user.headline}</p>
            )}
          </div>

          <div className="shrink-0">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border",
                ROLE_STYLES[user.role]
              )}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              {ROLE_LABELS[user.role]}
            </span>
          </div>
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-5 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5" />
            <span>{user.email}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            <span>Joined {memberSince}</span>
          </div>
          {user.website && (
            <a
              href={user.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-indigo-400 transition-colors"
            >
              <Globe className="w-3.5 h-3.5" />
              <span className="truncate max-w-50">
                {user.website.replace(/^https?:\/\//, "")}
              </span>
            </a>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-800">
          {statItems.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                  <Icon className={cn("w-4 h-4", s.color)} />
                </div>
                <div>
                  <p className="text-lg font-black text-white tabular-nums leading-none">
                    {s.value}
                  </p>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 mt-1">
                    {s.label}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}