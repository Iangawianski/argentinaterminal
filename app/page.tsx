import type { Metadata } from "next";

import { Launchpad } from "@/components/home/launchpad";

export const metadata: Metadata = {
  title: "ArgentinaTerminal",
  description:
    "Hub para el inversor argentino: bonos hard-dollar, riesgo país, dólar, CEDEARs y noticias de economía en un solo dashboard.",
};

// 60s revalidate: bonds + FX move intra-day but not faster; news is 10-min
// cached upstream. This keeps the home cacheable at the edge.
export const revalidate = 60;

export default function HomePage() {
  return <Launchpad />;
}
