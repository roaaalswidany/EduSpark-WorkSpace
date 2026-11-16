import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/cairo";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { ThemedToaster } from "@/components/providers/themed-toaster";

export const metadata: Metadata = {
  title: "EduSpark Workspace",
  description: "LMS && Marketplace",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <ThemedToaster />
        </ThemeProvider>
      </body>
    </html>
  );
}