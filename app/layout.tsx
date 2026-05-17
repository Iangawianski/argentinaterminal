import "./globals.css";

import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Providers } from "@/components/providers";
import { Topbar } from "@/components/topbar";
import { CommandPalette } from "@/components/command-palette";

export const metadata: Metadata = {
  title: {
    default: "ArgentinaTerminal",
    template: "%s · ArgentinaTerminal",
  },
  description:
    "Terminal abierta para el mercado argentino: acciones, CEDEARs, bonos, FX y macro en un solo lugar.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es-AR" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <Providers>
          <div className="flex min-h-screen flex-col">
            <Topbar />
            <main className="flex-1">{children}</main>
          </div>
          <CommandPalette />
        </Providers>
      </body>
    </html>
  );
}
