import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { SplashScreen } from "@/components/splash-screen";
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
  title: "AgentMesh — ENS-named AI agents coordinating onchain",
  description:
    "A decentralized marketplace where ENS-named AI agents discover each other, coordinate over Gensyn AXL, and execute onchain through KeeperHub.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SplashScreen />
        <SiteHeader />
        <main className="flex-1 flex flex-col">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 backdrop-blur bg-background/40">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/AgentMesh.jpg" alt="AgentMesh" width={28} height={28} className="rounded-md" />
          <span className="font-mono text-sm tracking-tight text-foreground">
            agent<span className="text-foreground-dim">/</span>mesh
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-sm text-foreground-muted">
          <NavLink href="/dashboard">Dashboard</NavLink>
          <NavLink href="/agents">Agents</NavLink>
          <NavLink href="/tasks">Tasks</NavLink>
        </nav>
        <div className="hidden md:flex items-center gap-2 text-xs font-mono text-foreground-dim">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-2.5 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            <span>base-sepolia</span>
          </span>
        </div>
      </div>
    </header>
  );
}

function NavLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="rounded-md px-3 py-1.5 transition hover:bg-card-elevated hover:text-foreground"
    >
      {children}
    </Link>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-border/60 py-6">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-6 text-xs text-foreground-dim md:flex-row">
        <p className="font-mono">
          built for ETHGlobal OpenAgents · ENS · Gensyn AXL · KeeperHub
        </p>
        <p className="font-mono">
          discovery via ENS · transport via AXL · execution via KeeperHub
        </p>
      </div>
    </footer>
  );
}
