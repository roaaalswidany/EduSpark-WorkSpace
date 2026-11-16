/* eslint-disable @typescript-eslint/no-unused-vars */
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import {
  Settings as SettingsIcon,
  Shield,
  User,
  Mail,
  Calendar,
  Palette,
} from "lucide-react";
import { ChangePasswordForm } from "./_components/change-password-form";
import { ThemeToggle } from "@/components/providers/theme-toggle";

export const metadata = { title: "Settings — EduSpark" };

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/login");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      role: true,
      createdAt: true,
      emailVerified: true,
    },
  });

  if (!user) redirect("/auth/login");

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div>
        <div className="flex items-center gap-2 text-xs font-bold text-primary mb-2">
          <SettingsIcon className="w-3.5 h-3.5" />
          <span className="uppercase tracking-widest">Settings</span>
        </div>
        <h1 className="text-2xl font-bold text-foreground">Account Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your account information and security.
        </p>
      </div>

      {/* Account Info */}
      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <User className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-bold text-foreground">Account Information</h2>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                Name
              </label>
              <p className="text-sm text-foreground">{user.name}</p>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                Email
              </label>
              <div className="flex items-center gap-2">
                <p className="text-sm text-foreground">{user.email}</p>
                {user.emailVerified ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold">
                    Verified
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-bold">
                    Unverified
                  </span>
                )}
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                Role
              </label>
              <p className="text-sm text-foreground capitalize">
                {user.role.toLowerCase()}
              </p>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                Member Since
              </label>
              <p className="text-sm text-foreground">
                {new Date(user.createdAt).toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Appearance */}
      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <Palette className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-bold text-foreground">Appearance</h2>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <p className="text-sm text-foreground font-medium">Theme</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Customize how EduSpark looks on your device.
            </p>
          </div>
          <ThemeToggle />
          <p className="text-[11px] text-muted-foreground/70">
            Choose &ldquo;System&rdquo; to automatically match your device settings.
          </p>
        </div>
      </div>

      {/* Change Password */}
      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <Shield className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-bold text-foreground">Security</h2>
        </div>
        <div className="p-5">
          <ChangePasswordForm />
        </div>
      </div>
    </div>
  );
}