import type { ParcelReport } from "@zeme/shared";
import {
  curateReport,
  type CuratedItem,
  type CuratedPanel,
} from "../lib/report-format";

function SourceLine({ source }: { source: NonNullable<CuratedPanel["source"]> }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-slate-500">
      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75" />
      </svg>
      <span>
        Šaltinis: {source.name}
        <span className="ml-1 text-slate-400">· {source.api}</span>
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
        className="wrap-break-word text-teal-700 underline decoration-teal-300 underline-offset-2 hover:text-teal-600"
      >
        Atidaryti nuorodą
      </a>
    );
  }
  return <span>{value}</span>;
}

function ItemBlock({ item, showHeading }: { item: CuratedItem; showHeading: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      {showHeading && item.heading ? (
        <p className="mb-3 text-lg font-semibold text-slate-900">{item.heading}</p>
      ) : null}
      <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
        {item.fields.map((field) => (
          <div key={field.label} className="flex flex-col">
            <dt className="text-base text-slate-600">{field.label}</dt>
            <dd className="text-lg font-medium text-slate-900">
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
  // expandable section, so they don't add clutter or imply hidden content.
  if (panel.state !== "ok") {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <span className="text-lg font-medium text-slate-700">{panel.title}</span>
          <span className="shrink-0 text-base text-slate-500">{panel.message}</span>
        </div>
        {panel.source ? (
          <div className="mt-2">
            <SourceLine source={panel.source} />
          </div>
        ) : null}
      </div>
    );
  }

  const showHeadings = panel.items.length > 1;

  return (
    <details className="report-disclosure rounded-xl border border-slate-300 bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
        <span className="flex items-center gap-3">
          <span className="text-lg font-semibold text-slate-900">{panel.title}</span>
          <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-base font-semibold text-teal-800">
            {panel.count}
          </span>
        </span>
        <svg
          viewBox="0 0 24 24"
          className="report-chevron h-5 w-5 shrink-0 text-slate-400"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </summary>
      <div className="grid gap-3 border-t border-slate-200 p-5">
        {panel.items.map((item, i) => (
          <ItemBlock key={i} item={item} showHeading={showHeadings} />
        ))}
        {panel.source ? (
          <div className="border-t border-slate-100 pt-3">
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
          <h3 className="text-xl font-bold text-slate-900">{category.title}</h3>
          {category.panels.map((panel) => (
            <Panel key={panel.key} panel={panel} />
          ))}
        </div>
      ))}
    </section>
  );
}
