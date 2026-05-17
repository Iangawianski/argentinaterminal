import type { Metadata } from "next";

import { BondsBoard, type BoardRow } from "@/components/bonds-board";
import { BONDS, buildCashflows } from "@/lib/bonds/cashflows";
import { getDefaultBondProvider } from "@/lib/bonds/composite";
import { computeBondMath } from "@/lib/bonds/math";
import { getDefaultFxProvider, type FxQuote } from "@/lib/fx";
import { getDefaultEmbiProvider, type RiesgoPais } from "@/lib/macro/embi";

export const metadata: Metadata = {
  title: "Bonos hard-dollar",
  description:
    "Panel de bonos soberanos argentinos hard-dollar: precio, TIR, paridad, duration y curva.",
};

export const revalidate = 30;

export default async function BonosPage() {
  const bondProvider = getDefaultBondProvider();
  const today = new Date().toISOString().slice(0, 10);

  const [rows, embi, mep] = await Promise.all([
    Promise.all(
      BONDS.map(async (bond): Promise<BoardRow> => {
        try {
          const quote = await bondProvider.getQuote(bond.symbol);
          const math = computeBondMath({
            bond,
            cleanPrice: quote.cleanPrice,
            settlementIso: today,
            cashflows: buildCashflows(bond),
          });
          return {
            symbol: bond.symbol,
            name: bond.name,
            law: bond.law,
            maturity: bond.maturity,
            quote,
            math,
            source: quote.source,
            error: null,
          };
        } catch (err) {
          return {
            symbol: bond.symbol,
            name: bond.name,
            law: bond.law,
            maturity: bond.maturity,
            quote: null,
            math: null,
            source: "unavailable",
            error: err instanceof Error ? err.message : "Unknown error",
          };
        }
      })
    ),
    safeEmbi(),
    safeMep(),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <BondsBoard
        initialBonds={{ rows, asOf: new Date().toISOString() }}
        initialEmbi={embi}
        initialMep={mep}
      />
    </div>
  );
}

async function safeEmbi(): Promise<RiesgoPais | null> {
  try {
    return await getDefaultEmbiProvider().getRiesgoPais();
  } catch {
    return null;
  }
}

async function safeMep(): Promise<FxQuote | null> {
  try {
    return await getDefaultFxProvider().get("mep");
  } catch {
    return null;
  }
}
