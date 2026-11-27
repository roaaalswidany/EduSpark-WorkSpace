import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/cairo";
import { ThemeProvider } from "@wrksz/themes/next";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { LanguageProvider } from "@/components/providers/language-provider";
import { ThemedToaster } from "@/components/providers/themed-toaster";
import "../globals.css";

export const metadata: Metadata = {
  title: "EduSpark Workspace",
  description: "LMS && Marketplace",
};

export function generateStaticParams() {
  return routing.locales.map((locale: string) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();
  const dir = locale === "ar" ? "rtl" : "ltr";

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <body>
        <NextIntlClientProvider messages={messages}>
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
        </NextIntlClientProvider>
      </body>
    </html>
  );
}