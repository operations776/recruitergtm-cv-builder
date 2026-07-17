import type { Metadata } from "next";
import "./globals.css";
import { display, body, mono } from "./fonts";

export const metadata: Metadata = {
  title: "CV Builder · RecruiterGTM",
  description:
    "Paste a candidate profile, confirm the match, and generate a polished branded CV.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${mono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
