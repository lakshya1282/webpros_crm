import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { QueryProvider } from "@/components/providers/query-provider";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: {
    default: "WhatsApp CRM",
    template: "%s | WhatsApp CRM",
  },
  description:
    "Single-operator WhatsApp outreach CRM — Import contacts, send campaigns, track replies, manage projects.",
  keywords: ["WhatsApp", "CRM", "outreach", "B2B", "leads"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className={`${inter.className} min-h-screen bg-background`}>
        <QueryProvider>
          {children}
          <Toaster
            theme="dark"
            position="bottom-right"
            toastOptions={{
              style: {
                background: "hsl(222 47% 8%)",
                border: "1px solid hsl(217 32% 17%)",
                color: "hsl(213 31% 91%)",
              },
            }}
          />
        </QueryProvider>
      </body>
    </html>
  );
}
