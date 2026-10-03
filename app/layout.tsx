import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Incident: duplicate statements from a lock that didn't hold",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
