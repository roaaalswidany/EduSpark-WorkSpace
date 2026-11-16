/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { SidebarXpBadge } from "./sidebar-xp-badge";
import {
  LayoutDashboard,
  MessageSquare,
  BookOpen,
  Award,
  Store,
  GraduationCap,
  Package,
  PlusCircle,
  User,
  ShieldCheck,
  Briefcase,
  LogOut,
  type LucideIcon,
  Inbox,
  ShoppingBag,
  Target,
  Trophy,
  Bell,
  Users,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Role } from "@prisma/client";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  exact?: boolean;
  roles?: Role[];
}

interface NavSection {
  title: string;
  items: NavItem[];
  roles?: Role[];
}

const SECTIONS: NavSection[] = [
  {
    title: "Main",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, exact: true },
      { label: "Career Path", href: "/dashboard/career-path", icon: Target, roles: ["STUDENT", "CREATOR"] },
      { label: "Achievements", href: "/dashboard/achievements", icon: Trophy, roles: ["STUDENT", "CREATOR"] },
      { label: "Messages", href: "/dashboard/chat", icon: MessageSquare },
      { label: "Notifications", href: "/dashboard/notifications", icon: Bell },
      { label: "Settings", href: "/dashboard/settings", icon: Settings },
    ],
  },
  {
    title: "Learn",
    roles: ["STUDENT", "CREATOR"],
    items: [
      { label: "My Courses", href: "/dashboard/student/courses", icon: BookOpen },
      { label: "Certificates", href: "/dashboard/student/certificates", icon: Award },
      { label: "Browse Courses", href: "/courses", icon: GraduationCap },
    ],
  },
  {
    title: "Work",
    roles: ["STUDENT", "CREATOR"],
    items: [
      { label: "Marketplace", href: "/marketplace", icon: Store },
      { label: "My Orders", href: "/dashboard/orders", icon: ShoppingBag },
      { label: "My Projects", href: "/dashboard/projects", icon: Briefcase },
    ],
  },
  {
    title: "Creator Studio",
    roles: ["CREATOR"],
    items: [
      { label: "My Courses", href: "/dashboard/creator/courses", icon: BookOpen },
      { label: "My Services", href: "/dashboard/creator/services", icon: Package },
      { label: "Incoming Orders", href: "/dashboard/creator/orders", icon: Inbox },
      { label: "New Service", href: "/dashboard/creator/services/new", icon: PlusCircle, exact: true },
    ],
  },
  {
    title: "Administration",
    roles: ["ADMIN"],
    items: [
      { label: "Overview", href: "/dashboard/admin", icon: LayoutDashboard, exact: true },
      { label: "Users", href: "/dashboard/admin/users", icon: Users },
      { label: "Courses", href: "/dashboard/admin/courses", icon: BookOpen },
      { label: "Services", href: "/dashboard/admin/services", icon: ShoppingBag },
    ],
  },
];

interface GamificationData {
  xp: number;
  level: string;
  levelLabel: string;
  levelIcon: string;
  levelColor: string;
  levelBg: string;
  levelBorder: string;
  levelGradient: string;
  progressPct: number;
  xpToNext: number;
  nextLevelLabel: string | null;
}

interface DashboardSidebarProps {
  role: Role;
  user: {
    name: string;
    email: string;
    image: string | null;
  };
  gamification: GamificationData;
  onNavigate?: () => void;
}

function Avatar({
  name,
  size = 40,
}: {
  name: string;
  size?: number;
}) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const hue = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360;

  return (
    <div
      className="rounded-xl flex items-center justify-center text-foreground font-bold ring-2 ring-border shrink-0"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: `hsl(${hue}, 55%, 42%)`,
      }}
    >
      {initials}
    </div>
  );
}

export function DashboardSidebar({
  role,
  user,
  gamification,
  onNavigate,
}: DashboardSidebarProps) {
  const pathname = usePathname();

  function isActive(item: NavItem): boolean {
    if (item.exact) return pathname === item.href;
    if (item.href === "/dashboard") return pathname === "/dashboard";
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  }

  const isProfileActive = pathname === "/dashboard/profile";
  const isAdmin = role === "ADMIN";

  return (
    <aside className="w-64 h-full flex flex-col bg-sidebar border-r border-sidebar-border">
      {/* Logo */}
      <div className="shrink-0 h-14 flex items-center gap-2 px-4 border-b border-sidebar-border">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
            <GraduationCap className="w-4 h-4 text-primary" />
          </div>
          <span className="text-sm font-bold text-sidebar-foreground">EduSpark</span>
        </Link>
        {isAdmin && (
          <span className="ml-auto text-[9px] font-bold uppercase tracking-wider text-info bg-info/10 border border-info/20 px-1.5 py-0.5 rounded">
            Admin
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {SECTIONS.map((section) => {
          if (section.roles && !section.roles.includes(role)) return null;

          const items = section.items.filter(
            (item) => !item.roles || item.roles.includes(role)
          );
          if (items.length === 0) return null;

          return (
            <div key={section.title}>
              <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {section.title}
              </p>
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const active = isActive(item);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all border",
                          active
                            ? "bg-primary/10 text-primary border-primary/20"
                            : "text-muted-foreground hover:text-foreground hover:bg-accent border-transparent"
                        )}
                      >
                        <Icon
                          className={cn(
                            "w-4 h-4 shrink-0",
                            active ? "text-primary" : "text-muted-foreground"
                          )}
                        />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="shrink-0 border-t border-sidebar-border p-3 space-y-1">
        {/* XP Badge — only for STUDENT / CREATOR */}
        {!isAdmin && (
          <SidebarXpBadge
            xp={gamification.xp}
            levelLabel={gamification.levelLabel}
            levelIcon={gamification.levelIcon}
            levelColor={gamification.levelColor}
            levelBg={gamification.levelBg}
            levelBorder={gamification.levelBorder}
            levelGradient={gamification.levelGradient}
            progressPct={gamification.progressPct}
            xpToNext={gamification.xpToNext}
            nextLevelLabel={gamification.nextLevelLabel}
            onNavigate={onNavigate}
          />
        )}

        {/* Profile card */}
        <Link
          href="/dashboard/profile"
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-3 px-2 py-2 rounded-lg transition-all border",
            isProfileActive
              ? "bg-primary/10 border-primary/20"
              : "border-transparent hover:bg-accent"
          )}
        >
          <Avatar name={user.name} size={36} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-sidebar-foreground truncate">
              {user.name}
            </p>
            <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
          </div>
          <User
            className={cn(
              "w-3.5 h-3.5 shrink-0",
              isProfileActive ? "text-primary" : "text-muted-foreground"
            )}
          />
        </Link>

        {/* Sign out */}
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/auth/login" })}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-lg",
            "text-sm font-medium text-muted-foreground",
            "hover:text-destructive hover:bg-destructive/10",
            "transition-all border border-transparent"
          )}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}