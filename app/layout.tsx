import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RecruiterGTM · CV Builder",
  description:
    "Paste a candidate's public profile, confirm the match, and generate a polished branded CV.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans">{children}</body>
    </html>
  );
}
