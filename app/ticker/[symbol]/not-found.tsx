import Link from "next/link";
import { messages } from "@/lib/messages/es-AR";

export default function NotFound() {
  return (
    <section className="mx-auto max-w-xl px-6 py-16 text-center">
      <h1 className="text-xl font-semibold">
        {messages.ticker.notFoundTitle}
      </h1>
      <p className="mt-2 text-sm text-[hsl(var(--muted-fg))]">
        {messages.ticker.notFoundCopy}
      </p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-md border px-3 py-1.5 text-sm hover:surface"
      >
        {messages.common.backHome}
      </Link>
    </section>
  );
}
