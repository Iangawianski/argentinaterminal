"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { SYMBOL_CATALOG, type SymbolKind } from "@/lib/catalog";
import { messages } from "@/lib/messages/es-AR";

type PaletteCtx = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const Ctx = createContext<PaletteCtx | null>(null);

export function CommandPaletteRoot({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const navigate = useCallback(
    (symbol: string) => {
      router.push(`/ticker/${symbol.toLowerCase()}`);
      setOpen(false);
    },
    [router],
  );

  const ctx = useMemo(() => ({ open, setOpen }), [open]);

  const grouped = useMemo(() => groupByKind(), []);

  return (
    <Ctx.Provider value={ctx}>
      {children}
      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 sm:pt-32"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Command label="Buscar ticker">
              <Command.Input
                autoFocus
                placeholder={messages.palette.placeholder}
              />
              <Command.List>
                <Command.Empty>{messages.palette.empty}</Command.Empty>
                {grouped.map(([kind, items]) => (
                  <Command.Group key={kind} heading={labelFor(kind)}>
                    {items.map((s) => (
                      <Command.Item
                        key={s.symbol}
                        value={`${s.symbol} ${s.name}`}
                        onSelect={() => navigate(s.symbol)}
                      >
                        <span className="font-mono">{s.symbol}</span>
                        <span className="text-xs text-[hsl(var(--muted-fg))]">
                          {s.name}
                        </span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                ))}
              </Command.List>
            </Command>
          </div>
        </div>
      ) : null}
    </Ctx.Provider>
  );
}

function groupByKind(): Array<[SymbolKind, typeof SYMBOL_CATALOG[number][]]> {
  const buckets = new Map<SymbolKind, typeof SYMBOL_CATALOG[number][]>();
  for (const s of SYMBOL_CATALOG) {
    const arr = buckets.get(s.kind) ?? [];
    arr.push(s);
    buckets.set(s.kind, arr);
  }
  const order: SymbolKind[] = ["stock", "cedear", "bond", "benchmark"];
  return order
    .filter((k) => buckets.has(k))
    .map((k) => [k, buckets.get(k)!] as const);
}

function labelFor(kind: SymbolKind): string {
  switch (kind) {
    case "stock":
      return messages.palette.sections.stocks;
    case "cedear":
      return messages.palette.sections.cedears;
    case "bond":
      return messages.palette.sections.bonds;
    case "benchmark":
      return messages.palette.sections.benchmarks;
  }
}

export function usePalette(): PaletteCtx {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error("usePalette must be used inside CommandPaletteRoot");
  }
  return ctx;
}

export function PaletteTrigger() {
  const { setOpen } = usePalette();
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="flex items-center gap-2 rounded-md border px-2 py-1 text-xs text-[hsl(var(--muted-fg))] hover:surface"
    >
      <span>{messages.topBar.paletteHint}</span>
      <kbd className="font-mono text-[10px]">Ctrl K</kbd>
    </button>
  );
}
