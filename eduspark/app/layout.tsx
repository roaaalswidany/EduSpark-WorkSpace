import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

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