import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { CommandPaletteRoot } from "@/components/command-palette";
import { TopBar } from "@/components/top-bar";
import "./globals.css";

export const metadata: Metadata = {
  title: "ArgentinaTerminal",
  description:
    "Terminal financiera open-source para el inversor argentino. CEDEARs, bonos hard-dollar, FX MEP/CCL, macro local — keyboard-first.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es-AR" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <CommandPaletteRoot>
            <div className="min-h-screen flex flex-col">
              <TopBar />
              <main className="flex-1">{children}</main>
            </div>
          </CommandPaletteRoot>
        </ThemeProvider>
      </body>
    </html>
  );
}
