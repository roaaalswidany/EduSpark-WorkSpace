import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/cairo";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { ThemedToaster } from "@/components/providers/themed-toaster";
import { LanguageProvider } from "../components/providers/language-provider";

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
            <LanguageProvider>
          {children}
          <ThemedToaster />
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}