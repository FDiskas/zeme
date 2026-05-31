import type { ParcelReport } from "@zeme/shared";

type Props = {
  report: ParcelReport;
};

type Item = Record<string, unknown>;

const EMPTY_VALUES = new Set(["", "n/a", "none", "null", "undefined"]);

function humanizeKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return EMPTY_VALUES.has(value.trim().toLowerCase());
  return false;
}

function FormattedValue({ value }: { value: unknown }) {
  if (isEmpty(value)) return <span className="text-slate-400">—</span>;

  if (typeof value === "string" && /^https?:\/\//i.test(value)) {
    return (
      <a
        href={value}
        target="_blank"
        rel="noreferrer"
        className="break-all text-teal-700 underline decoration-teal-300 underline-offset-2 hover:text-teal-600"
      >
        {value}
      </a>
    );
  }

  if (typeof value === "boolean") return <>{value ? "Yes" : "No"}</>;

  if (typeof value === "number") return <>{value.toLocaleString("lt-LT")}</>;

  if (typeof value === "object") {
    return <span className="text-slate-600">{JSON.stringify(value)}</span>;
  }

  return <>{String(value)}</>;
}

function ItemCard({ item, showHeader }: { item: Item; showHeader: boolean }) {
  const entries = Object.entries(item);
  // Use the first string-ish field as a card heading when there are several items.
  const headingKey = entries.find(
    ([, v]) => typeof v === "string" && !isEmpty(v),
  )?.[0];

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
      {showHeader && headingKey ? (
        <p className="mb-3 text-sm font-semibold text-slate-900">
          {String(item[headingKey])}
        </p>
      ) : null}
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
        {entries.map(([key, value]) =>
          showHeader && key === headingKey ? null : (
            <div key={key} className="flex flex-col">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                {humanizeKey(key)}
              </dt>
              <dd className="text-sm text-slate-800">
                <FormattedValue value={value} />
              </dd>
            </div>
          ),
        )}
      </dl>
    </div>
  );
}

export function ReportPanel({ report }: Props) {
  return (
    <section className="grid gap-4">
      {report.reportPanels.map((panel) => {
        const items = panel.items as Item[];
        const multiple = items.length > 1;

        return (
          <article
            key={panel.key}
            className={`min-w-0 rounded-xl border p-5 shadow-sm transition hover:shadow-md ${
              panel.status === "error"
                ? "border-rose-200 bg-rose-50/10"
                : "border-slate-300 bg-white"
            }`}
          >
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-lg font-semibold text-slate-900">{panel.title}</h3>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                  panel.status === "ok"
                    ? "bg-emerald-100 text-emerald-800"
                    : panel.status === "partial"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-rose-100 text-rose-800"
                }`}
              >
                {panel.status}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">Source: {panel.source}</p>

            {panel.status === "error" ? (
              <div className="mt-3 rounded-lg border border-rose-100 bg-rose-50 p-4 text-sm text-rose-900 shadow-sm">
                <div className="flex items-start gap-2">
                  <span className="font-bold text-rose-500" aria-hidden="true">
                    ⚠️
                  </span>
                  <div>
                    <p className="font-semibold">Service Unavailable</p>
                    <p className="mt-1 text-rose-800">
                      {panel.note ||
                        "Upstream service integration is not configured or is currently unavailable."}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {panel.note ? (
                  <p className="mt-2 text-sm text-slate-600">{panel.note}</p>
                ) : null}
                {items.length > 0 ? (
                  <div className="mt-3 grid gap-3">
                    {items.map((item, i) => (
                      <ItemCard key={i} item={item} showHeader={multiple} />
                    ))}
                  </div>
                ) : null}
              </>
            )}
          </article>
        );
      })}
    </section>
  );
}
