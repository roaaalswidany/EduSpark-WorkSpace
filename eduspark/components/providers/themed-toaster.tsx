"use client";

import { Toaster as SonnerToaster } from "sonner";
import { useTheme } from "next-themes";

/**
 * Client wrapper for sonner's <Toaster> that follows next-themes'
 * resolved theme (class-based), instead of always using prefers-color-scheme.
 */
export function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  const theme = (resolvedTheme ?? "system") as "light" | "dark" | "system";

  return (
    <SonnerToaster
      theme={theme}
      position="top-right"
      richColors
      closeButton
    />
  );
}