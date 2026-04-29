import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
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
  title: "Anonymous Meme Vault",
  description: "Upload, tag, search, and download meme templates anonymously.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabaseHost = (() => {
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      return url ? new URL(url).origin : null;
    } catch {
      return null;
    }
  })();

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <head>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="dns-prefetch" href="//fonts.gstatic.com" />
        {supabaseHost ? <link rel="preconnect" href={supabaseHost} crossOrigin="" /> : null}
        {supabaseHost ? <link rel="dns-prefetch" href={supabaseHost.replace("https://", "//")} /> : null}
      </head>
      <body className="min-h-full bg-slate-950 text-slate-100 antialiased">
        {children}
      </body>
      <Analytics />
    </html>
  );
}
