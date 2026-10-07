"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
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
      { label: "Messages", href: "/dashboard/chat", icon: MessageSquare },
    ],
  },
  {
    title: "Learn",
    items: [
      { label: "My Courses", href: "/dashboard/student/courses", icon: BookOpen },
      { label: "Certificates", href: "/dashboard/student/certificates", icon: Award },
      { label: "Browse Courses", href: "/courses", icon: GraduationCap },
    ],
  },
  {
    title: "Work",
    items: [
      { label: "Marketplace", href: "/marketplace", icon: Store },
      { label: "My Orders", href: "/dashboard/orders", icon: ShoppingBag },
      { label: "My Projects", href: "/dashboard/projects", icon: Briefcase },
    ],
  },
  {
    title: "Creator Studio",
    roles: ["CREATOR", "ADMIN"],
    items: [
      { label: "My Services", href: "/dashboard/creator/services", icon: Package },
      { label: "Incoming Orders", href: "/dashboard/creator/orders", icon: Inbox },
      { label: "New Service", href: "/dashboard/creator/services/new", icon: PlusCircle, exact: true },
    ],
  },
  {
    title: "Admin",
    roles: ["ADMIN"],
    items: [
      { label: "Admin Panel", href: "/dashboard/admin", icon: ShieldCheck },
    ],
  },
];

interface DashboardSidebarProps {
  role: Role;
  user: {
    name: string;
    email: string;
    image: string | null;
  };
  onNavigate?: () => void;
}

function Avatar({
  name,
  image,
  size = 40,
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
  const hue = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360;

  if (image) {
    return (
      <Image
        src={image}
        alt={name}
        width={size}
        height={size}
        className="rounded-xl object-cover ring-2 ring-slate-800"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className="rounded-xl flex items-center justify-center text-white font-bold ring-2 ring-slate-800 shrink-0"
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
  onNavigate,
}: DashboardSidebarProps) {
  const pathname = usePathname();

  function isActive(item: NavItem): boolean {
    if (item.exact) return pathname === item.href;
    if (item.href === "/dashboard") return pathname === "/dashboard";
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  }

  const isProfileActive = pathname === "/dashboard/profile";

  return (
    <aside className="w-64 h-full flex flex-col bg-slate-900 border-r border-slate-800">
      {/* Logo */}
      <div className="shrink-0 h-14 flex items-center gap-2 px-4 border-b border-slate-800">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <GraduationCap className="w-4 h-4 text-indigo-400" />
          </div>
          <span className="text-sm font-bold text-white">EduSpark</span>
        </Link>
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
              <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-600">
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
                          "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                          active
                            ? "bg-indigo-500/10 text-indigo-300 border border-indigo-500/20"
                            : "text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-transparent"
                        )}
                      >
                        <Icon
                          className={cn(
                            "w-4 h-4 shrink-0",
                            active ? "text-indigo-400" : "text-slate-500"
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

      {/* User footer — Profile link + Sign out */}
      <div className="shrink-0 border-t border-slate-800 p-3 space-y-1">
        {/* Profile card */}
        <Link
          href="/dashboard/profile"
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-3 px-2 py-2 rounded-lg transition-all border",
            isProfileActive
              ? "bg-indigo-500/10 border-indigo-500/20"
              : "border-transparent hover:bg-slate-800"
          )}
        >
          <Avatar name={user.name} image={user.image} size={36} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-200 truncate">
              {user.name}
            </p>
            <p className="text-[10px] text-slate-600 truncate">{user.email}</p>
          </div>
          <User
            className={cn(
              "w-3.5 h-3.5 shrink-0",
              isProfileActive ? "text-indigo-400" : "text-slate-600"
            )}
          />
        </Link>

        {/* Sign out */}
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/auth/login" })}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-lg",
            "text-sm font-medium text-slate-400",
            "hover:text-red-400 hover:bg-red-500/10",
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