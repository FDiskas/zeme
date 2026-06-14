import type { ParcelReport } from "@zeme/shared";
import {
  curateReport,
  type CuratedItem,
  type CuratedPanel,
} from "../lib/report-format";
import { ChevronDown, SourceIcon } from "./icons";

function SourceLine({ source }: { source: NonNullable<CuratedPanel["source"]> }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-mist-500">
      <SourceIcon className="h-4 w-4 shrink-0 text-mist-400" />
      <span>
        Šaltinis: {source.name}
        <span className="ml-1 text-mist-400">· {source.api}</span>
      </span>
    </p>
  );
}

type Props = {
  report: ParcelReport;
};

function FieldValue({ value, isLink }: { value: string; isLink?: boolean }) {
  if (isLink && /^https?:\/\//i.test(value)) {
    return (
      <a
        href={value}
        target="_blank"
        rel="noreferrer"
        className="wrap-break-word text-forest-700 underline decoration-forest-300 underline-offset-2 hover:text-forest-800"
      >
        Atidaryti nuorodą
      </a>
    );
  }
  return <span>{value}</span>;
}

function ItemBlock({ item, showHeading }: { item: CuratedItem; showHeading: boolean }) {
  return (
    <div className="rounded-2xl border border-mist-200 bg-mist-50 p-4">
      {showHeading && item.heading ? (
        <p className="mb-3 text-lg font-semibold text-mist-900">{item.heading}</p>
      ) : null}
      <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
        {item.fields.map((field) => (
          <div key={field.label} className="flex flex-col">
            <dt className="text-base text-mist-500">{field.label}</dt>
            <dd className="text-lg font-medium text-mist-900">
              <FieldValue value={field.value} isLink={field.isLink} />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Panel({ panel }: { panel: CuratedPanel }) {
  // Empty or upstream-unavailable panels: a quiet, honest one-liner — not an
  // expandable section, so they don't add clutter or imply hidden content. The
  // source is intentionally omitted here; it only appears inside an expanded
  // panel (below), so "Įrašų nerasta." stays uncluttered.
  if (panel.state !== "ok") {
    return (
      <div id={`panel-${panel.key}`} className="scroll-mt-24 rounded-2xl border border-mist-200 bg-white px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <span className="text-lg font-medium text-mist-700">{panel.title}</span>
          <span className="shrink-0 text-base text-mist-500">{panel.message}</span>
        </div>
      </div>
    );
  }

  const showHeadings = panel.items.length > 1;

  return (
    <details
      id={`panel-${panel.key}`}
      className="report-disclosure scroll-mt-24 rounded-2xl border border-mist-200 bg-white transition hover:border-mist-300"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600">
        <span className="flex items-center gap-3">
          <span className="text-lg font-semibold text-mist-900">{panel.title}</span>
          <span className="rounded-full bg-forest-100 px-2.5 py-0.5 text-base font-semibold text-forest-800">
            {panel.count}
          </span>
        </span>
        <ChevronDown className="report-chevron h-5 w-5 shrink-0 text-mist-400" />
      </summary>
      <div className="grid gap-3 border-t border-mist-200 p-5">
        {panel.items.map((item, i) => (
          <ItemBlock key={i} item={item} showHeading={showHeadings} />
        ))}
        {panel.source ? (
          <div className="border-t border-mist-100 pt-3">
            <SourceLine source={panel.source} />
          </div>
        ) : null}
      </div>
    </details>
  );
}

export function ReportPanel({ report }: Props) {
  const categories = curateReport(report);

  return (
    <section className="grid gap-8">
      {categories.map((category) => (
        <div key={category.id} className="grid gap-3">
          <h3 className="font-display text-xl font-bold tracking-tight text-mist-900">{category.title}</h3>
          {category.panels.map((panel) => (
            <Panel key={panel.key} panel={panel} />
          ))}
        </div>
      ))}
    </section>
  );
}
