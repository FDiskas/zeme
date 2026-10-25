import type { ParcelReport } from "@zeme/shared";
import { Link } from "react-router-dom";
import {
  curateReport,
  type CuratedItem,
  type CuratedPanel,
} from "../lib/report-format";
import { ChevronDown, PinIcon, SourceIcon } from "./icons";

function SourceLine({ source }: { source: NonNullable<CuratedPanel["source"]> }) {
  return (
    <p className="flex items-start gap-2 text-base text-mist-600">
      <SourceIcon className="mt-1 h-4 w-4 shrink-0 text-mist-500" />
      <span className="min-w-0">
        Šaltinis: {source.name} ({source.api})
      </span>
    </p>
  );
}

type Props = {
  report: ParcelReport;
};

const LINK_CLASS =
  "rounded-sm text-forest-700 underline decoration-forest-300 underline-offset-4 transition-colors hover:text-forest-900 hover:decoration-forest-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600";

function FieldValue({ value, isLink, href }: { value: string; isLink?: boolean; href?: string }) {
  if (href) {
    return (
      <Link to={href} className={`inline-flex items-start gap-1.5 ${LINK_CLASS}`}>
        <PinIcon className="mt-1 h-5 w-5 shrink-0" />
        <span className="wrap-break-word">{value}</span>
      </Link>
    );
  }
  if (isLink && /^https?:\/\//i.test(value)) {
    return (
      <a href={value} target="_blank" rel="noreferrer" className={`wrap-break-word ${LINK_CLASS}`}>
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
        <p className="mb-2 text-lg font-semibold text-mist-900">{item.heading}</p>
      ) : null}
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 @sm:grid-cols-2">
        {item.fields.map((field) => (
          <div key={field.label} className="flex min-w-0 flex-col">
            <dt className="text-base text-mist-600">{field.label}</dt>
            <dd className="text-lg text-mist-900">
              <FieldValue value={field.value} isLink={field.isLink} href={field.href} />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Panel({ panel }: { panel: CuratedPanel }) {
  // Empty or upstream-unavailable panels: one quiet line, not an expandable
  // row, so they don't add clutter or imply hidden content. The source is
  // intentionally omitted here; it only appears inside an expanded panel.
  if (panel.state !== "ok") {
    return (
      <li
        id={`panel-${panel.key}`}
        className="flex scroll-mt-24 flex-wrap items-baseline justify-between gap-x-4 px-4 py-3 text-base"
      >
        <span className="text-mist-800">{panel.title}</span>
        <span className="text-mist-600">{panel.message}</span>
      </li>
    );
  }

  return (
    <li>
      <details id={`panel-${panel.key}`} className="report-disclosure scroll-mt-24">
        <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-4 py-3 transition-colors hover:bg-mist-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-forest-600 active:bg-mist-100">
          <span className="min-w-0 flex-1 text-lg font-semibold text-mist-900">{panel.title}</span>
          <span className="shrink-0 rounded-full bg-forest-100 px-2.5 text-base font-semibold text-forest-800 tabular-nums">
            {panel.count}
          </span>
          <ChevronDown className="report-chevron h-5 w-5 shrink-0 text-mist-500" />
        </summary>
        <div className="divide-y divide-mist-200 border-t border-mist-200 bg-mist-50 px-4 pt-3 pb-4">
          {panel.items.map((item, i) => (
            <ItemBlock key={i} item={item} />
          ))}
          {panel.note ? <p className="py-3 text-base text-mist-700">{panel.note}</p> : null}
          {panel.source ? (
            <div className="pt-3">
              <SourceLine source={panel.source} />
            </div>
          ) : null}
        </div>
      </details>
    </li>
  );
}

export function ReportPanel({ report }: Props) {
  const categories = curateReport(report);

  return (
    <div className="grid gap-5">
      {categories.map((category) => (
        <section key={category.id} className="grid gap-2">
          <h3 className="font-display text-xl font-bold tracking-tight text-mist-900">{category.title}</h3>
          <ul className="divide-y divide-mist-200 overflow-hidden rounded-2xl border border-mist-200 bg-white">
            {category.panels.map((panel) => (
              <Panel key={panel.key} panel={panel} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
