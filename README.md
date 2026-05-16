# ArgentinaTerminal

Open-source, Bloomberg-style securities terminal focused on the Argentine retail/advanced investor.

Status: Phase 1 (Foundations + GGAL end-to-end). Pre-alpha.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript strict
- Tailwind CSS v4 (CSS-first config)
- shadcn/ui primitives + cmdk command palette
- Vitest for unit tests; Playwright planned for e2e
- Deploys to Vercel (preview only until launch gate)

## Local development

```bash
npm install
npm run dev          # http://localhost:3000
npm run typecheck    # strict tsc --noEmit
npm run test         # vitest run
npm run lint         # next lint (flat config)
npm run build        # production build
```

UI strings live in `lib/messages/es-AR.ts`. Code, comments, docs are in English.

## Data sources

See `lib/providers/`. Phase 1 ships a single live adapter for BYMA leader-panel equities (`ggal`) plus mock-backed unit tests. Live calls are skipped in CI; see `__tests__/`.

Roadmap and phase scope are tracked in the [ARG-1 plan document](./docs/plan.md) (mirror of the issue document).

## License

MIT.
