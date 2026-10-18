import type { Metadata } from "next";
export const dynamic = "force-dynamic";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { Providers } from "@/components/layout/Providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sudoku Arena — Treine. Compita. Evolua.",
  description:
    "Sudoku Arena: Sudoku casual, aprendizado e competição. Modo Solo completo, Guia de técnicas, desafio diário, multiplayer e ranking.",
  keywords: ["Sudoku", "Sudoku Arena", "puzzle", "brain game", "competitive sudoku", "multiplayer"],
  authors: [{ name: "Sudoku Arena" }],
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "Sudoku Arena",
    description: "Treine. Compita. Evolua.",
    siteName: "Sudoku Arena",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Sudoku Arena",
    description: "Treine. Compita. Evolua.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <Providers>{children}</Providers>
        <SonnerToaster richColors position="top-center" style={{ zIndex: 9999 }} />
      </body>
    </html>
  );
}
