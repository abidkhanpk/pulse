import type { Metadata } from "next";
import * as React from "react";
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

export async function generateMetadata(): Promise<Metadata> {
  const { getAppName } = await import("@/lib/app-settings");
  const appName = await getAppName();
  return {
    title: `${appName} — Lab Management`,
    description: "MEDD lab management system: desk booking, projects, logbook, attendance",
    icons: {
      icon: [
        { url: "/brand/favicon-light.png", media: "(prefers-color-scheme: light)" },
        { url: "/brand/favicon-dark.png", media: "(prefers-color-scheme: dark)" },
      ],
      apple: "/brand/apple-touch-icon.png",
    },
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("pulse-theme");if(t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme: dark)").matches)){document.documentElement.classList.add("dark")}var a=localStorage.getItem("pulse-accent");if(a){document.documentElement.setAttribute("data-accent",a)}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
