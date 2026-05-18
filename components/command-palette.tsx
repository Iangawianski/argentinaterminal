"use client";

import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  Activity,
  Banknote,
  Compass,
  DollarSign,
  Gauge,
  LineChart,
  Moon,
  Sun,
  TrendingUp,
} from "lucide-react";

import { BONDS } from "@/lib/bonds/cashflows";
import { FX_KEYS, FX_LABELS, type FxKey } from "@/lib/fx";
import { INSTRUMENTS } from "@/lib/instruments";

interface CommandPaletteContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const value = useMemo<CommandPaletteContextValue>(
    () => ({
      isOpen,
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
      toggle: () => setIsOpen((v) => !v),
    }),
    [isOpen]
  );

  return <CommandPaletteContext.Provider value={value}>{children}</CommandPaletteContext.Provider>;
}

export function useCommandPalette(): CommandPaletteContextValue {
  const ctx = useContext(CommandPaletteContext);
  if (!ctx) {
    throw new Error("useCommandPalette must be used inside <CommandPaletteProvider>");
  }
  return ctx;
}

const FX_KEY_HINTS: Record<FxKey, string> = {
  oficial: "Tipo de cambio minorista BNA",
  mayorista: "Interbancario A3500",
  blue: "Informal de efectivo",
  mep: "AL30 / AL30D — bolsa local",
  ccl: "Contado con liquidación",
};

export function CommandPalette() {
  const router = useRouter();
  const { setTheme } = useTheme();
  const ctx = useContext(CommandPaletteContext);

  const setOpen = useCallback(
    (v: boolean) => {
      if (!ctx) return;
      if (v) ctx.open();
      else ctx.close();
    },
    [ctx]
  );

  useEffect(() => {
    if (!ctx) return;
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        ctx!.toggle();
      } else if (e.key === "Escape") {
        ctx!.close();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [ctx]);

  if (!ctx) return null;

  const goto = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const groupHeadingClass =
    "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground";
  const itemClass =
    "flex cursor-pointer items-center justify-between gap-2 rounded-md px-3 py-2 text-foreground aria-selected:bg-muted";

  return (
    <Command.Dialog
      open={ctx.isOpen}
      onOpenChange={setOpen}
      label="Command palette"
      className="fixed inset-0 z-50 flex items-start justify-center bg-foreground/30 p-4 backdrop-blur-sm data-[state=closed]:hidden"
    >
      <div className="mt-24 w-full max-w-xl overflow-hidden rounded-xl border border-border bg-background shadow-2xl">
        <Command label="Command menu" className="flex flex-col">
          <div className="border-b border-border px-3 py-2">
            <Command.Input
              autoFocus
              placeholder="Buscar ticker, FX o comando…"
              className="w-full bg-transparent py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
          <Command.List className="max-h-80 overflow-y-auto p-2 text-sm">
            <Command.Empty className="px-3 py-6 text-center text-sm text-muted-foreground">
              Sin resultados.
            </Command.Empty>

            <Command.Group heading="Tickers" className={groupHeadingClass}>
              {INSTRUMENTS.map((inst) => (
                <Command.Item
                  key={inst.symbol}
                  value={`${inst.symbol} ${inst.name}`}
                  onSelect={() => goto(`/ticker/${inst.symbol}`)}
                  className={itemClass}
                >
                  <span className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" aria-hidden />
                    <span className="font-mono text-xs font-semibold">{inst.symbol}</span>
                    <span className="text-muted-foreground">{inst.name}</span>
                  </span>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {inst.kind === "stock"
                      ? "Acción"
                      : inst.kind === "cedear"
                        ? "CEDEAR"
                        : inst.kind === "bond"
                          ? "Bono"
                          : "FX"}
                  </span>
                </Command.Item>
              ))}
            </Command.Group>

            <Command.Group heading="Dólar" className={groupHeadingClass}>
              <Command.Item
                value="fx dashboard tablero dolares"
                onSelect={() => goto("/fx")}
                className={itemClass}
              >
                <span className="flex items-center gap-2">
                  <Banknote className="h-4 w-4 text-muted-foreground" aria-hidden />
                  <span>Ir al tablero FX</span>
                </span>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  /fx
                </span>
              </Command.Item>
              {FX_KEYS.map((k) => (
                <Command.Item
                  key={k}
                  value={`dolar ${k} ${FX_LABELS[k]}`}
                  onSelect={() => goto(`/fx#${k}`)}
                  className={itemClass}
                >
                  <span className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" aria-hidden />
                    <span>Ver dólar {FX_LABELS[k]}</span>
                  </span>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {FX_KEY_HINTS[k]}
                  </span>
                </Command.Item>
              ))}
            </Command.Group>

            <Command.Group heading="Bonos" className={groupHeadingClass}>
              <Command.Item
                value="bonos panel soberanos tabla"
                onSelect={() => goto("/bonos")}
                className={itemClass}
              >
                <span className="flex items-center gap-2">
                  <LineChart className="h-4 w-4 text-muted-foreground" aria-hidden />
                  <span>Ir al panel de bonos</span>
                </span>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  /bonos
                </span>
              </Command.Item>
              <Command.Item
                value="curva soberana yield hard dollar"
                onSelect={() => goto("/bonos#curva")}
                className={itemClass}
              >
                <span className="flex items-center gap-2">
                  <LineChart className="h-4 w-4 text-muted-foreground" aria-hidden />
                  <span>Ver curva soberana</span>
                </span>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  TIR vs. duration
                </span>
              </Command.Item>
              <Command.Item
                value="riesgo pais embi ambito"
                onSelect={() => goto("/bonos#riesgo")}
                className={itemClass}
              >
                <span className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-muted-foreground" aria-hidden />
                  <span>Ver riesgo país</span>
                </span>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  EMBI+ Argentina (Ámbito)
                </span>
              </Command.Item>
              {BONDS.map((bond) => (
                <Command.Item
                  key={bond.symbol}
                  value={`bono ${bond.symbol} ${bond.name}`}
                  onSelect={() => goto(`/ticker/${bond.symbol}`)}
                  className={itemClass}
                >
                  <span className="flex items-center gap-2">
                    <Banknote className="h-4 w-4 text-muted-foreground" aria-hidden />
                    <span className="font-mono text-xs font-semibold">{bond.symbol}</span>
                    <span className="text-muted-foreground">{bond.name}</span>
                  </span>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {bond.law === "AR" ? "Ley AR" : "Ley NY"}
                  </span>
                </Command.Item>
              ))}
            </Command.Group>

            <Command.Group heading="Macro" className={groupHeadingClass}>
              <Command.Item
                value="macro bcra reservas badlar tamar ipc inflacion base monetaria"
                onSelect={() => goto("/macro")}
                className={itemClass}
              >
                <span className="flex items-center gap-2">
                  <Gauge className="h-4 w-4 text-muted-foreground" aria-hidden />
                  <span>Ir al panel macro (BCRA)</span>
                </span>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  /macro
                </span>
              </Command.Item>
            </Command.Group>

            <Command.Group heading="Navegación" className={groupHeadingClass}>
              <Command.Item onSelect={() => goto("/")} className={itemClass}>
                <span className="flex items-center gap-2">
                  <Compass className="h-4 w-4 text-muted-foreground" aria-hidden />
                  <span>Ir al inicio</span>
                </span>
              </Command.Item>
            </Command.Group>

            <Command.Group heading="Tema" className={groupHeadingClass}>
              <Command.Item
                onSelect={() => {
                  setTheme("light");
                  setOpen(false);
                }}
                className={itemClass}
              >
                <span className="flex items-center gap-2">
                  <Sun className="h-4 w-4 text-muted-foreground" aria-hidden />
                  <span>Tema claro</span>
                </span>
              </Command.Item>
              <Command.Item
                onSelect={() => {
                  setTheme("dark");
                  setOpen(false);
                }}
                className={itemClass}
              >
                <span className="flex items-center gap-2">
                  <Moon className="h-4 w-4 text-muted-foreground" aria-hidden />
                  <span>Tema oscuro</span>
                </span>
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </Command.Dialog>
  );
}
