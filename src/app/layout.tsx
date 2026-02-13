import type { Metadata } from "next";
import { Syne, Lexend, Fira_Code } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const lexend = Lexend({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

const firaCode = Fira_Code({
  subsets: ["latin"],
  variable: "--font-code",
  display: "swap",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Agent Lint",
  description: "Create perfect context files for AI coding agents.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${syne.variable} ${lexend.variable} ${firaCode.variable}`}
    >
      <body className="antialiased font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
