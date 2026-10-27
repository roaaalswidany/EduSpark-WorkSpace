import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata = { title: "Reset password · EduSpark" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; token?: string }>;
}) {
  const { email, token } = await searchParams;
  const valid = !!email && !!token && /^[a-f0-9]{64}$/.test(token);
  return (
    <AuthCard title="Choose a new password">
      {valid ? (
        <ResetPasswordForm email={email!} token={token!} />
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-red-400">This reset link is incomplete or invalid.</p>
          <Link href="/auth/forgot-password" className="text-sm text-indigo-400 hover:text-indigo-300">
            Request a new link
          </Link>
        </div>
      )}
    </AuthCard>
  );
}
