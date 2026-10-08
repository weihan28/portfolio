import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Instrument_Serif } from "next/font/google";
import "./globals.css";

// Self-hosted by next/font; globals.css reads them through --display, --body and --mono.
const display = Instrument_Serif({ weight: "400", style: ["normal", "italic"], subsets: ["latin"], variable: "--font-display" });
const body = IBM_Plex_Sans({ weight: ["400", "500", "600"], subsets: ["latin"], variable: "--font-body" });
const mono = IBM_Plex_Mono({ weight: ["400", "500"], subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Wei Han",
  description: "Chin Wei Han, software engineer working on AI, from model architectures to production systems.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Dark for everyone, whatever their system setting. The light palette stays in globals.css; switch this to
    // "light" (or remove it to follow each visitor's setting) to use it.
    <html lang="en" data-theme="dark" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
