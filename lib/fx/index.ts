import { DolarApiProvider } from "@/lib/fx/dolarapi";
import type { FxProvider } from "@/lib/fx/types";

let defaultProvider: FxProvider | null = null;

export function getDefaultFxProvider(): FxProvider {
  if (!defaultProvider) {
    defaultProvider = new DolarApiProvider();
  }
  return defaultProvider;
}

export type { FxKey, FxQuote, FxProvider } from "@/lib/fx/types";
export { FX_KEYS, FX_LABELS } from "@/lib/fx/types";
export { DolarApiProvider, DOLARAPI_BASE } from "@/lib/fx/dolarapi";
