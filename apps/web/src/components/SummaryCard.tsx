import type { ParcelReport } from "@zeme/shared";
import { buildSummary, type SummaryFlag } from "../lib/report-format";

type Props = {
  report: ParcelReport;
};

const FLAG_STYLES: Record<SummaryFlag["state"], string> = {
  clear: "border-emerald-200 bg-emerald-50 text-emerald-900",
  present: "border-amber-300 bg-amber-50 text-amber-900",
  info: "border-slate-300 bg-slate-50 text-slate-800",
};

function FlagIcon({ state }: { state: SummaryFlag["state"] }) {
  if (state === "clear") {
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
      </svg>
    );
  }
  if (state === "present") {
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6 text-amber-600" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 text-slate-500" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
    </svg>
  );
}

export function SummaryCard({ report }: Props) {
  const { facts, flags } = buildSummary(report);

  return (
    <section className="rounded-2xl border border-slate-300 bg-white p-6 shadow-sm md:p-8">
      <h2 className="text-2xl font-bold text-slate-900 md:text-3xl">{report.address}</h2>
      <p className="mt-1 text-lg text-slate-600">Kadastrinis Nr. {report.cadastralRegNo}</p>

      {facts.length > 0 ? (
        <dl className="mt-6 grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          {facts.map((fact) => (
            <div key={fact.label}>
              <dt className="text-base text-slate-600">{fact.label}</dt>
              <dd className="mt-0.5 text-xl font-semibold text-slate-900">{fact.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {flags.length > 0 ? (
        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          {flags.map((flag) => (
            <div
              key={flag.label}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${FLAG_STYLES[flag.state]}`}
            >
              <FlagIcon state={flag.state} />
              <div className="min-w-0">
                <p className="text-base font-medium leading-tight">{flag.label}</p>
                <p className="text-lg font-bold leading-tight">{flag.detail}</p>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
