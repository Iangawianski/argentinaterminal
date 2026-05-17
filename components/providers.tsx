"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useState, type ReactNode } from "react";

import { CommandPaletteProvider } from "@/components/command-palette";

export function Providers({ children }: { children: ReactNode }) {
  // One client per browser session; staleTime aligned with the 30s server
  // cache so client refetches do not hammer the upstream providers.
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={client}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
        <CommandPaletteProvider>{children}</CommandPaletteProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
