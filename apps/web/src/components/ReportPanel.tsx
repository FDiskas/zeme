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
    <p className="flex items-start gap-2 text-sm text-muted">
      <SourceIcon className="mt-1 h-4 w-4 shrink-0" />
      <span className="min-w-0">
        Šaltinis: {source.name} ({source.api})
      </span>
    </p>
  );
}

type Props = {
  report: ParcelReport;
};


function FieldValue({ value, isLink, href }: { value: string; isLink?: boolean; href?: string }) {
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
    <div className="@container py-4 first:pt-0">
      {item.heading ? (
        <p className="mb-2 text-md font-medium text-ink">{item.heading}</p>
      ) : null}
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 @sm:grid-cols-2">
        {item.fields.map((field) => (
          <div key={field.label} className={`flex min-w-0 flex-col${field.wide ? " @sm:col-span-2" : ""}`}>
            <dt className="text-sm text-muted">{field.label}</dt>
            <dd className="text-md text-ink">
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
        className="flex scroll-mt-(--nav-clear) flex-wrap items-baseline justify-between gap-x-4 px-3 py-3 text-sm"
      >
        <span className="text-ink-2">{panel.title}</span>
        <span className="text-muted">{panel.message}</span>
      </li>
    );
  }

  return (
    <li>
      <details id={`panel-${panel.key}`} className="report-disclosure scroll-mt-(--nav-clear)">
        <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-3 py-3 transition-colors duration-150 hover:bg-paper-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus active:bg-paper-3">
          <span className="min-w-0 flex-1 text-md font-medium text-ink">{panel.title}</span>
          <span className="code shrink-0 text-sm text-ink-2">{panel.count}</span>
          <ChevronDown className="report-chevron h-5 w-5 shrink-0 text-ink" />
        </summary>
        <div className="divide-y divide-rule bg-paper-2 px-5 pt-4 pb-5">
          {panel.items.map((item, i) => (
            <ItemBlock key={i} item={item} />
          ))}
          {panel.note ? <p className="py-3 text-sm text-ink-2">{panel.note}</p> : null}
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
    <div className="grid gap-10">
      {categories.map((category) => (
        <section key={category.id} className="grid gap-3">
          <h3 className="text-lg leading-tight">{category.title}</h3>
          <ul className="spec">
            {category.panels.map((panel) => (
              <Panel key={panel.key} panel={panel} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
