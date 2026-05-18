import { describe, expect, it } from "vitest";

import { BcraContractError, BcraProvider, BCRA_VARIABLES } from "./bcra";

const RESERVAS_PAYLOAD = {
  status: 200,
  metadata: { resultset: { count: 4, offset: 0, limit: 1000 } },
  results: [
    {
      idVariable: 1,
      detalle: [
        { fecha: "2026-05-13", valor: 46534.0 },
        { fecha: "2026-05-12", valor: 46186.0 },
        { fecha: "2026-05-11", valor: 46144.0 },
        { fecha: "2026-05-08", valor: 46061.0 },
      ],
    },
  ],
};

const BADLAR_PAYLOAD = {
  status: 200,
  metadata: { resultset: { count: 3, offset: 0, limit: 1000 } },
  results: [
    {
      idVariable: 7,
      detalle: [
        { fecha: "2026-05-14", valor: 21.25 },
        { fecha: "2026-05-13", valor: 21.0 },
        { fecha: "2026-05-12", valor: 20.75 },
      ],
    },
  ],
};

function makeProvider(payload: unknown): BcraProvider {
  const fetchImpl = async (): Promise<Response> =>
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  return new BcraProvider({ fetchImpl: fetchImpl as typeof fetch });
}

describe("BcraProvider.getSeries", () => {
  it("returns chronologically-sorted points for reservas", async () => {
    const p = makeProvider(RESERVAS_PAYLOAD);
    const s = await p.getSeries("reservas", 7);
    expect(s.idVariable).toBe(BCRA_VARIABLES.reservas.id);
    expect(s.points.map((x) => x.date)).toEqual([
      "2026-05-08",
      "2026-05-11",
      "2026-05-12",
      "2026-05-13",
    ]);
    expect(s.points.at(-1)?.value).toBe(46534);
  });

  it("throws BcraContractError on missing variable record", async () => {
    const p = makeProvider({ status: 200, results: [{ idVariable: 999, detalle: [] }] });
    await expect(p.getSeries("reservas", 7)).rejects.toBeInstanceOf(BcraContractError);
  });

  it("throws on malformed payload", async () => {
    const p = makeProvider({ wrong: "shape" });
    await expect(p.getSeries("reservas", 7)).rejects.toBeInstanceOf(BcraContractError);
  });

  it("throws on HTTP error", async () => {
    const fetchImpl = async (): Promise<Response> =>
      new Response("{}", { status: 500 });
    const p = new BcraProvider({ fetchImpl: fetchImpl as typeof fetch });
    await expect(p.getSeries("reservas", 7)).rejects.toThrow(/HTTP 500/);
  });
});

describe("BcraProvider.getLatest", () => {
  it("computes level delta + deltaPct for FX-style variables (reservas)", async () => {
    const p = makeProvider(RESERVAS_PAYLOAD);
    const snap = await p.getLatest("reservas");
    expect(snap.value).toBe(46534);
    expect(snap.previousValue).toBe(46186);
    expect(snap.delta).toBeCloseTo(348, 6);
    expect(snap.deltaPct).toBeCloseTo((348 / 46186) * 100, 6);
  });

  it("keeps deltaPct null for rate-style variables (BADLAR)", async () => {
    const p = makeProvider(BADLAR_PAYLOAD);
    const snap = await p.getLatest("badlar");
    expect(snap.value).toBe(21.25);
    expect(snap.previousValue).toBe(21);
    expect(snap.delta).toBeCloseTo(0.25, 6);
    expect(snap.deltaPct).toBeNull();
  });

  it("handles single-observation series gracefully", async () => {
    const p = makeProvider({
      status: 200,
      results: [{ idVariable: 1, detalle: [{ fecha: "2026-05-13", valor: 100 }] }],
    });
    const snap = await p.getLatest("reservas");
    expect(snap.previousValue).toBeNull();
    expect(snap.delta).toBeNull();
    expect(snap.deltaPct).toBeNull();
  });

  it("throws BcraContractError on empty series", async () => {
    const p = makeProvider({
      status: 200,
      results: [{ idVariable: 1, detalle: [] }],
    });
    await expect(p.getLatest("reservas")).rejects.toBeInstanceOf(BcraContractError);
  });
});
