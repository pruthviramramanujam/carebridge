import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  applicationName: "TraceMed",
  title: "TraceMed | Medical Record Reconciliation",
  description:
    "Organize medical records, extract explicitly labeled facts, and surface missing dates, conflicting values, duplicates, and source gaps for human review.",
  openGraph: {
    title: "TraceMed | Medical Record Reconciliation",
    description:
      "Evidence-linked medical record review with browser-local image OCR. Findings require human review and are not clinical conclusions.",
    siteName: "TraceMed",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "TraceMed | Medical Record Reconciliation",
    description:
      "Evidence-linked medical record review with browser-local image OCR. Findings require human review and are not clinical conclusions.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
