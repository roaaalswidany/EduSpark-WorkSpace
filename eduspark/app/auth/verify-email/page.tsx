import { AuthCard } from "@/components/auth/auth-card";
import { VerifyEmailButton } from "./verify-email-button";

export const metadata = { title: "Confirm email · EduSpark" };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; token?: string }>;
}) {
  const { email, token } = await searchParams;
  const valid = !!email && !!token && /^[a-f0-9]{64}$/.test(token);
  return (
    <AuthCard title="Confirm your email">
      {valid ? (
        <VerifyEmailButton email={email!} token={token!} />
      ) : (
        <p className="text-sm text-red-400">This confirmation link is incomplete or invalid.</p>
      )}
    </AuthCard>
  );
}
