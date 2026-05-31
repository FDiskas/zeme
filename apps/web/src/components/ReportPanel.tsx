import type { ParcelReport } from "@zeme/shared";

type Props = {
  report: ParcelReport;
};

export function ReportPanel({ report }: Props) {
  return (
    <section className="grid gap-4">
      {report.reportPanels.map((panel) => (
        <article
          key={panel.key}
          className={`rounded-xl border p-5 shadow-sm transition hover:shadow-md min-w-0 ${
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
                <span className="text-rose-500 font-bold" aria-hidden="true">⚠️</span>
                <div>
                  <p className="font-semibold">Service Unavailable</p>
                  <p className="mt-1 text-rose-800">
                    {panel.note || "Upstream service integration is not configured or is currently unavailable."}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              {panel.note ? <p className="mt-2 text-sm text-slate-600">{panel.note}</p> : null}
              <pre className="mt-3 w-full max-w-full overflow-x-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100">
                {JSON.stringify(panel.items, null, 2)}
              </pre>
            </>
          )}
        </article>
      ))}
    </section>
  );
}
