import type { ReactNode } from "react";

// The reading pages (Apie projektą, Naudojimosi taisyklės): the title and its
// lead on one line of the grid, as on the sources page, then ruled sections,
// each heading in the left columns and its text in a reading measure beside it.
export function DocPage({ title, lead, updated, children }: {
  title: string;
  lead: ReactNode;
  /** ISO date the text last changed, shown under the lead. */
  updated?: string;
  children: ReactNode;
}) {
  return (
    <main id="main" className="container grid gap-16 pt-16 pb-24 md:pt-24">
      <div className="grid gap-6 md:grid-cols-12 md:items-end md:gap-8">
        <h1 className="text-display md:col-span-6">{title}</h1>
        <div className="grid gap-3 md:col-span-6">
          <p className="max-w-[60ch] text-lg text-ink-2">{lead}</p>
          {updated ? (
            <p className="text-sm text-muted">
              Atnaujinta <time dateTime={updated}>{updated}</time>
            </p>
          ) : null}
        </div>
      </div>

      <div className="spec">{children}</div>
    </main>
  );
}

export function DocSection({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="grid scroll-mt-24 gap-4 py-10 md:grid-cols-12 md:gap-8">
      <h2 className="text-title md:col-span-4">{title}</h2>
      <div className="grid max-w-[65ch] content-start gap-4 text-md text-ink md:col-span-8 md:col-start-5">
        {children}
      </div>
    </section>
  );
}
