/* eslint-disable @typescript-eslint/no-unused-vars */
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { Settings as SettingsIcon, Shield, User, Mail, Calendar } from "lucide-react";
import { ChangePasswordForm } from "./_components/change-password-form";

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
        <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 mb-2">
          <SettingsIcon className="w-3.5 h-3.5" />
          <span className="uppercase tracking-widest">Settings</span>
        </div>
        <h1 className="text-2xl font-bold text-white">Account Settings</h1>
        <p className="text-sm text-slate-400 mt-1">
          Manage your account information and security.
        </p>
      </div>

      {/* Account Info */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-2">
          <User className="w-4 h-4 text-slate-400" />
          <h2 className="text-sm font-bold text-white">Account Information</h2>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Name</label>
              <p className="text-sm text-white">{user.name}</p>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Email</label>
              <div className="flex items-center gap-2">
                <p className="text-sm text-white">{user.email}</p>
                {user.emailVerified ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                    Verified
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold">
                    Unverified
                  </span>
                )}
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Role</label>
              <p className="text-sm text-white capitalize">{user.role.toLowerCase()}</p>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Member Since</label>
              <p className="text-sm text-white">
                {new Date(user.createdAt).toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Change Password */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-2">
          <Shield className="w-4 h-4 text-slate-400" />
          <h2 className="text-sm font-bold text-white">Security</h2>
        </div>
        <div className="p-5">
          <ChangePasswordForm />
        </div>
      </div>
    </div>
  );
}