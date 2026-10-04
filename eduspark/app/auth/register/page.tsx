"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, GraduationCap, AlertCircle, Check } from "lucide-react";
import { registerAction, type RegisterInput } from "@/actions/auth/register";

type FieldErrors = Partial<Record<keyof RegisterInput, string[]>>;

const PASSWORD_RULES = [
  { regex: /.{8,}/, label: "At least 8 characters" },
  { regex: /[A-Z]/, label: "One uppercase letter" },
  { regex: /[a-z]/, label: "One lowercase letter" },
  { regex: /[0-9]/, label: "One number" },
  { regex: /[^A-Za-z0-9]/, label: "One special character" },
];

export default function RegisterPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<"STUDENT" | "CREATOR">("STUDENT");

  const [isPending, setIsPending] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGeneralError(null);
    setFieldErrors({});
    setIsPending(true);

    const result = await registerAction({
      name,
      email,
      password,
      confirmPassword,
      role,
    });

    setIsPending(false);

    if (!result.success) {
      setGeneralError(result.error);
      if (result.fieldErrors) setFieldErrors(result.fieldErrors);
      return;
    }

    // نجاح → توجيه لصفحة الدخول مع رسالة نجاح
    router.push("/auth/login?registered=1");
  }

  const passwordsMatch =
    confirmPassword.length > 0 && password === confirmPassword;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 py-10">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-4">
            <GraduationCap className="w-7 h-7 text-indigo-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Create your account</h1>
          <p className="text-sm text-slate-500 mt-1">
            Join EduSpark and start learning
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Name */}
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-slate-300 mb-1.5"
              >
                Full name
              </label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isPending}
                placeholder="John Doe"
                className="w-full h-11 px-3 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 transition-all"
              />
              {fieldErrors.name?.[0] && (
                <p className="text-xs text-red-400 mt-1.5">
                  {fieldErrors.name[0]}
                </p>
              )}
            </div>

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-slate-300 mb-1.5"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isPending}
                placeholder="you@example.com"
                className="w-full h-11 px-3 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 transition-all"
              />
              {fieldErrors.email?.[0] && (
                <p className="text-xs text-red-400 mt-1.5">
                  {fieldErrors.email[0]}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-300 mb-1.5"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isPending}
                placeholder="••••••••"
                className="w-full h-11 px-3 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 transition-all"
              />

              {/* Password rules */}
              {password.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {PASSWORD_RULES.map((rule, i) => {
                    const passed = rule.regex.test(password);
                    return (
                      <li
                        key={i}
                        className={`flex items-center gap-1.5 text-xs ${
                          passed ? "text-emerald-400" : "text-slate-600"
                        }`}
                      >
                        <Check
                          className={`w-3 h-3 ${
                            passed ? "opacity-100" : "opacity-30"
                          }`}
                        />
                        {rule.label}
                      </li>
                    );
                  })}
                </ul>
              )}

              {fieldErrors.password?.[0] && (
                <p className="text-xs text-red-400 mt-1.5">
                  {fieldErrors.password[0]}
                </p>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-slate-300 mb-1.5"
              >
                Confirm password
              </label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isPending}
                placeholder="••••••••"
                className="w-full h-11 px-3 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 transition-all"
              />
              {confirmPassword.length > 0 && !passwordsMatch && (
                <p className="text-xs text-red-400 mt-1.5">
                  Passwords do not match.
                </p>
              )}
              {fieldErrors.confirmPassword?.[0] && (
                <p className="text-xs text-red-400 mt-1.5">
                  {fieldErrors.confirmPassword[0]}
                </p>
              )}
            </div>

            {/* Role */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                I want to join as
              </label>
              <div className="grid grid-cols-2 gap-2">
              <button
  type="button"
  onClick={() => setRole("STUDENT")}
  disabled={isPending}
  className={`h-11 rounded-lg text-sm font-medium transition-all ${
    role === "STUDENT"
      ? "bg-indigo-600 text-white border-2 border-indigo-500"
      : "bg-slate-950 text-slate-400 border border-slate-700 hover:border-slate-600"
  }`}
>
  Student
</button>
<button
  type="button"
  onClick={() => setRole("CREATOR")}
  disabled={isPending}
  className={`h-11 rounded-lg text-sm font-medium transition-all ${
    role === "CREATOR"
      ? "bg-indigo-600 text-white border-2 border-indigo-500"
      : "bg-slate-950 text-slate-400 border border-slate-700 hover:border-slate-600"
  }`}
>
  Creator
</button>
              </div>
            </div>

            {/* General error */}
            {generalError && (
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-300">{generalError}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={
                isPending ||
                !name ||
                !email ||
                !password ||
                !confirmPassword ||
                !passwordsMatch
              }
              className="w-full h-11 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating account…
                </>
              ) : (
                "Create account"
              )}
            </button>
          </form>

          {/* Login link */}
          <p className="text-center text-sm text-slate-500 mt-6">
            Already have an account?{" "}
            <Link
              href="/auth/login"
              className="text-indigo-400 hover:text-indigo-300 font-medium"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}