import { describe, expect, it, vi } from "vitest";

import {
  AmbitoEmbiProvider,
  EmbiContractError,
  parseAmbitoRiesgoHtml,
  parseAmbitoRiesgoJson,
} from "./embi";

// Inline fixture (same as __fixtures__/ambito-riesgo.html) — jsdom env can't read FS.
const FIXTURE = `<!doctype html>
<html lang="es-AR">
  <head><title>Riesgo País Argentina — Ámbito</title></head>
  <body>
    <main class="article">
      <header>
        <h1>Riesgo País Argentina</h1>
        <p class="subtitle">Indicador JPMorgan EMBI+ Argentina</p>
      </header>
      <section class="indicador">
        <h2>Riesgo País</h2>
        <p class="valor">
          <span class="numero">1.245</span>
          <span class="unidad">pb</span>
          <span class="variacion">−12 pb</span>
        </p>
        <p class="actualizado">Actualizado a las 17:30</p>
      </section>
    </main>
  </body>
</html>`;

function mockFetch(
  body: string,
  init?: { ok?: boolean; status?: number; contentType?: string }
) {
  return vi.fn(async () => ({
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    text: async () => body,
    json: async () => body,
    headers: new Headers({ "content-type": init?.contentType ?? "text/html" }),
  })) as unknown as typeof fetch;
}

describe("parseAmbitoRiesgoHtml", () => {
  it("extracts 1245 bps and a -12 bps change from the fixture", () => {
    const { valueBps, changeBps } = parseAmbitoRiesgoHtml(FIXTURE);
    expect(valueBps).toBe(1245);
    expect(changeBps).toBe(-12);
  });

  it("accepts plain integer bps without thousands separator", () => {
    const html = "<p>Riesgo País: 875 pb</p>";
    const { valueBps } = parseAmbitoRiesgoHtml(html);
    expect(valueBps).toBe(875);
  });

  it("rejects implausibly low numbers (under 50 bps)", () => {
    const html = "<p>Riesgo País: 12 pb</p>";
    expect(() => parseAmbitoRiesgoHtml(html)).toThrow(EmbiContractError);
  });

  it("throws when the label is missing", () => {
    const html = "<p>Algun otro indicador: 1.234</p>";
    expect(() => parseAmbitoRiesgoHtml(html)).toThrow(EmbiContractError);
  });
});

describe("parseAmbitoRiesgoJson", () => {
  it("extracts ultimo + variacion (Argentine decimal comma)", () => {
    const { valueBps, changePct } = parseAmbitoRiesgoJson({
      ultimo: "534",
      fecha: "18-05-2026",
      variacion: "-0,74%",
      "class-variacion": "down-green",
    });
    expect(valueBps).toBe(534);
    expect(changePct).toBeCloseTo(-0.74, 6);
  });

  it("tolerates ultimo as a number and missing variacion", () => {
    const { valueBps, changePct } = parseAmbitoRiesgoJson({ ultimo: 1234 });
    expect(valueBps).toBe(1234);
    expect(changePct).toBeNull();
  });

  it("rejects non-object payloads", () => {
    expect(() => parseAmbitoRiesgoJson("nope")).toThrow(EmbiContractError);
    expect(() => parseAmbitoRiesgoJson(null)).toThrow(EmbiContractError);
  });

  it("rejects ultimo outside the plausible band", () => {
    expect(() => parseAmbitoRiesgoJson({ ultimo: "12" })).toThrow(EmbiContractError);
    expect(() => parseAmbitoRiesgoJson({ ultimo: "999999" })).toThrow(EmbiContractError);
  });
});

describe("AmbitoEmbiProvider.getRiesgoPais", () => {
  it("returns Ámbito-source result on the happy path", async () => {
    const provider = new AmbitoEmbiProvider({ fetchImpl: mockFetch(FIXTURE) });
    const result = await provider.getRiesgoPais();
    expect(result.source).toBe("ambito");
    expect(result.valueBps).toBe(1245);
    expect(result.changeBps).toBe(-12);
  });

  it("falls back to the FRED spread when Ámbito 5xx and resolvers are wired", async () => {
    const provider = new AmbitoEmbiProvider({
      fetchImpl: mockFetch("", { ok: false, status: 503 }),
      ust10yResolver: async () => 0.045, // 4.5%
      argSpreadResolver: async () => 0.18, // 18%
    });
    const result = await provider.getRiesgoPais();
    expect(result.source).toBe("fred-spread");
    expect(result.valueBps).toBe(Math.round((0.18 - 0.045) * 10_000));
  });

  it("throws a unified error when neither source can serve data", async () => {
    const provider = new AmbitoEmbiProvider({
      fetchImpl: mockFetch("", { ok: false, status: 503 }),
      ust10yResolver: async () => null,
      argSpreadResolver: async () => null,
    });
    await expect(provider.getRiesgoPais()).rejects.toThrow(/EMBI sources unavailable/);
  });
});
