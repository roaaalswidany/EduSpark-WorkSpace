import type { Metadata } from "next";
// Self-hosted variable fonts (no build-time call to Google Fonts → offline /
// Docker builds are reproducible). Families: "Inter Variable", "Cairo Variable".
import "@fontsource-variable/inter";
import "@fontsource-variable/cairo";
import { Toaster } from "sonner";
import "./globals.css";

// ─── Metadata ────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: "EduSpark Workspace",
  description: "LMS && Marketplace",
};

// ─── Root Layout ─────────────────────────────────────────────────────────────

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster
          theme="dark"
          position="top-right"
          richColors
          closeButton
          toastOptions={{
            style: {
              background: "rgb(15 23 42)",
              border: "1px solid rgb(30 41 59)",
              color: "rgb(226 232 240)",
            },
          }}
        />
      </body>
    </html>
  );
}