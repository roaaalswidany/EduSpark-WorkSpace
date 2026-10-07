import type { Metadata } from "next";
import { Inter, Cairo } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

// ─── Fonts ───────────────────────────────────────────────────────────────────

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
  display: "swap",
});

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
    <html lang="en" className={`${inter.variable} ${cairo.variable}`}>
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