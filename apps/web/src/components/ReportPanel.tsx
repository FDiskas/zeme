import { Fragment, useState } from "react";
import type { ParcelReport } from "@zeme/shared";
import { Link } from "react-router-dom";
import {
  curateReport,
  type CuratedItem,
  type CuratedPanel,
} from "../lib/report-format";
import { ArrowUpIcon, ChevronDown, InfoIcon, PinIcon, RefreshIcon, SourceIcon } from "./icons";

const formatDate = (iso: string) => new Date(iso).toISOString().slice(0, 10);

// The registry a citizen recognises, and how fresh its data are. The dataset's
// technical name (ntr_sklypai, CENSUS2021_…) is for whoever wants to verify,
// so it waits behind the ℹ key.
function SourceLine({ source, checkedAt }: { source: NonNullable<CuratedPanel["source"]>; checkedAt: string }) {
  return (
    <div className="flex items-start gap-2 text-sm text-muted">
      <SourceIcon className="mt-1 h-4 w-4 shrink-0" />
      <div className="min-w-0">
        <p>
          Šaltinis: {source.name}.{" "}
          {source.dataDate ? `Duomenų data: ${source.dataDate}.` : `Patikrinta ${formatDate(checkedAt)}.`}
        </p>
        <details className="group">
          <summary className="inline-flex cursor-pointer list-none [&::-webkit-details-marker]:hidden items-center gap-1.5 rounded-pill py-1 hover:text-ink focus-visible:outline-2 focus-visible:outline-focus">
            <InfoIcon className="h-4 w-4 shrink-0" />
            <span className="underline decoration-rule underline-offset-4">Techninis pavadinimas</span>
          </summary>
          <p className="code wrap-break-word">{source.api}</p>
        </details>
      </div>
    </div>
  );
}

type Props = {
  report: ParcelReport;
  /** Ask the sources again, offered on a panel whose source failed. */
  onRetry?: () => void;
  retrying?: boolean;
};

function FieldValue({ value, isLink, href, externalHref }: { value: string; isLink?: boolean; href?: string; externalHref?: string }) {
  if (externalHref) {
    return (
      <a href={externalHref} target="_blank" rel="noreferrer" className="link wrap-break-word">
        {value}
      </a>
    );
  }
  if (href) {
    return (
      <Link to={href} className="link inline-flex items-start gap-1.5">
        <PinIcon className="mt-1 h-5 w-5 shrink-0" />
        <span className="wrap-break-word">{value}</span>
      </Link>
    );
  }
  if (isLink && /^https?:\/\//i.test(value)) {
    return (
      <a href={value} target="_blank" rel="noreferrer" className="link wrap-break-word">
        Atidaryti nuorodą
      </a>
    );
  }
  return <span className="wrap-break-word">{value}</span>;
}

// A heading exists only where a field rule opted in (isHeading), so it is
// shown even for a panel's single item — it carries data (a permit's type, a
// broadband technology), not a repeat of the panel title. Items part with a
// hairline rather than a box, so a panel never nests a card inside a card.
function ItemBlock({ item }: { item: CuratedItem }) {
  return (
    <div className="@container py-3 first:pt-0">
      {item.heading ? (
        <p className="mb-2 text-md font-medium text-ink">{item.heading}</p>
      ) : null}
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 @sm:grid-cols-2">
        {item.fields.map((field) => (
          <div key={field.label} className={`flex min-w-0 flex-col${field.wide ? " @sm:col-span-2" : ""}`}>
            <dt className="text-sm text-muted">{field.label}</dt>
            <dd className="text-md text-ink">
              <FieldValue value={field.value} isLink={field.isLink} href={field.href} externalHref={field.externalHref} />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// How many records an opened panel shows before "Rodyti visus": enough to
// read the gist, few enough that one panel never floods the column.
const FIRST_ITEMS = 3;

type PanelProps = { panel: CuratedPanel; checkedAt: string; onRetry?: () => void; retrying: boolean };

function Panel({ panel, checkedAt, onRetry, retrying }: PanelProps) {
  const [showAll, setShowAll] = useState(false);

  // Empty or upstream-unavailable panels: one quiet row, not an expandable
  // one, so they don't add clutter or imply hidden content. The source is
  // intentionally omitted here; it only appears inside an expanded panel. A
  // failed source gets a key to ask again; a gated one, where to check.
  if (panel.state !== "ok") {
    return (
      <li id={`panel-${panel.key}`} className="grid scroll-mt-[calc(var(--nav-clear)+1rem)] justify-items-start gap-1 px-2 py-3">
        <span className="text-md text-ink-2">{panel.title}</span>
        {panel.message ? <span className="line-clamp-3 text-sm text-muted">{panel.message}</span> : null}
        {panel.links ? (
          <span className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {panel.links.map((link) => (
              <a key={link.href} href={link.href} target="_blank" rel="noreferrer" className="link whitespace-nowrap">
                {link.label}
              </a>
            ))}
          </span>
        ) : null}
        {panel.retryable && onRetry ? (
          <button type="button" onClick={onRetry} disabled={retrying} aria-busy={retrying} className="btn btn--secondary btn--s mt-1">
            <RefreshIcon className="h-5 w-5" />
            {retrying ? "Bandoma…" : "Bandyti dar kartą"}
          </button>
        ) : null}
      </li>
    );
  }

  const items = showAll ? panel.items : panel.items.slice(0, FIRST_ITEMS);
  const hidden = panel.items.length - items.length;

  // The finding comes first: the panel's plain-language insight sits in the
  // row itself, so most readers never need to open it.
  return (
    <li>
      <details id={`panel-${panel.key}`} className="report-disclosure scroll-mt-[calc(var(--nav-clear)+1rem)]">
        <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 rounded-pill px-2 py-3 transition-colors duration-150 hover:bg-paper-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus active:bg-paper-3">
          <span className="grid min-w-0 flex-1 gap-0.5">
            <span className="text-md font-medium text-ink">{panel.title}</span>
            {panel.insight ? <span className="report-insight line-clamp-2 text-sm text-ink-2">{panel.insight}</span> : null}
          </span>{" "}
          {panel.countLabel ? <span className="chip min-h-8 shrink-0 px-2.5 py-1.5 whitespace-nowrap">{panel.countLabel}</span> : null}
          <ChevronDown className="report-chevron h-5 w-5 shrink-0 text-ink" />
        </summary>
        <div className="mx-2 mb-3 divide-y divide-rule rounded-card bg-paper-2 px-4 pt-4 pb-3">
          {items.map((item, i) => (
            <Fragment key={i}>
              {/* A stage sub-heading opens each run of items in the same group;
                  it sits flush on its first item, with no hairline between. */}
              {item.group && item.group !== items[i - 1]?.group ? (
                <p className="border-b-0 pt-4 pb-1 text-md font-semibold text-ink first:pt-0">{item.group}</p>
              ) : null}
              <ItemBlock item={item} />
            </Fragment>
          ))}
          {hidden > 0 ? (
            <div className="py-3">
              <button type="button" onClick={() => setShowAll(true)} className="btn btn--secondary btn--s">
                Rodyti visus ({panel.items.length})
              </button>
            </div>
          ) : null}
          {panel.note ? <p className="py-3 text-sm text-ink-2">{panel.note}</p> : null}
          {panel.source ? (
            <div className="pt-3">
              <SourceLine source={panel.source} checkedAt={checkedAt} />
            </div>
          ) : null}
        </div>
      </details>
    </li>
  );
}

const isPlainEmpty = (panel: CuratedPanel) => panel.state === "empty" && !panel.message;

const generatedAt = (iso: string) =>
  new Intl.DateTimeFormat("lt-LT", { year: "numeric", month: "long", day: "numeric" }).format(new Date(iso));

// Panels that found nothing and have nothing more to say, gathered into one
// "Nerasta: …" line so they don't each take a row. Each keeps its anchor, so
// a summary flag can still jump to it.
function NothingFound({ panels }: { panels: CuratedPanel[] }) {
  return (
    <li className="px-2 py-3 text-md text-ink-2">
      {panels.map((panel) => (
        <span key={panel.key} id={`panel-${panel.key}`} className="scroll-mt-[calc(var(--nav-clear)+1rem)]" />
      ))}
      <span className="font-medium text-ink">Nerasta:</span> {panels.map((panel) => panel.title).join(", ")}
    </li>
  );
}

export function ReportPanel({ report, onRetry, retrying = false }: Props) {
  const categories = curateReport(report);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8">
      {/* Table of contents: every section one tap away, all of them in view. */}
      <nav aria-label="Ataskaitos skyriai">
        <ul className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <li key={category.id} className="shrink-0">
              <a href={`#skyrius-${category.id}`} className="btn btn--secondary btn--s">
                {category.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {categories.map((category) => (
        <section key={category.id} id={`skyrius-${category.id}`} className="grid scroll-mt-[calc(var(--nav-clear)+1rem)] gap-2">
          <h3 className="text-lg leading-tight">{category.title}</h3>
          <ul className="spec">
            {category.panels
              .filter((panel) => !isPlainEmpty(panel))
              .map((panel) => (
                <Panel key={panel.key} panel={panel} checkedAt={report.fetchedAt} onRetry={onRetry} retrying={retrying} />
              ))}
            {category.panels.some(isPlainEmpty) ? <NothingFound panels={category.panels.filter(isPlainEmpty)} /> : null}
          </ul>
        </section>
      ))}

      <footer className="grid gap-4 border-t border-ink pt-6 text-sm text-ink-2">
        {/* The Lithuanian long date already ends in "d.", so no closing period. */}
        <p>Ataskaita sugeneruota {generatedAt(report.fetchedAt)}</p>
        <p>
          Ataskaita sudaryta iš viešų valstybės registrų duomenų. Duomenys gali keistis, todėl prieš
          priimdami svarbų sprendimą (pirkdami, statydami) informaciją pasitikrinkite pirminiuose
          šaltiniuose: Nekilnojamojo turto registre, savivaldybėje ar pas matininką.
        </p>
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="btn btn--secondary btn--s w-fit"
        >
          <ArrowUpIcon className="h-5 w-5" />
          Grįžti į viršų
        </button>
      </footer>
    </div>
  );
}
