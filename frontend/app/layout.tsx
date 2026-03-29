import type { Metadata } from "next";
import { Manrope, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import "katex/dist/katex.min.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Clerse | Oceanic Workspace",
  description: "Spatial infinite canvas for Claude conversations.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`light ${manrope.variable} ${plusJakartaSans.variable}`}
    >
      <body className="bg-surface text-on-surface font-body selection:bg-secondary-container selection:text-on-secondary-container antialiased">
        {children}
      </body>
    </html>
  );
}
