import type { ParcelReport } from "@zeme/shared";
import { buildSummary, type SummaryFlag } from "../lib/report-format";
import { CheckIcon, InfoIcon, WarningIcon } from "./icons";

type Props = {
  report: ParcelReport;
};

// Flag colours map to meaning, never decoration: olive = clear/positive,
// amber = something present to check, sand = neutral/info. Each also carries an
// icon so meaning never rests on colour alone (ux: color-not-only).
const FLAG_STYLES: Record<SummaryFlag["state"], string> = {
  clear: "border-olive-200 bg-olive-50 text-olive-800",
  present: "border-amber-200 bg-amber-50 text-amber-900",
  info: "border-sand-300 bg-sand-50 text-sand-800",
};

function FlagIcon({ state }: { state: SummaryFlag["state"] }) {
  if (state === "clear") return <CheckIcon className="h-6 w-6 shrink-0 text-olive-600" />;
  if (state === "present") return <WarningIcon className="h-6 w-6 shrink-0 text-amber-700" />;
  return <InfoIcon className="h-6 w-6 shrink-0 text-sand-500" />;
}

export function SummaryCard({ report }: Props) {
  const { facts, flags } = buildSummary(report);

  return (
    <section className="rounded-2xl border border-sand-200 bg-white p-6 shadow-sm md:p-8">
      <div className="border-l-4 border-clay-500 pl-4">
        <h2 className="font-serif text-2xl font-bold text-sand-900 md:text-3xl">
          {report.address}
        </h2>
        <p className="mt-1 text-lg text-sand-600">Kadastrinis Nr. {report.cadastralRegNo}</p>
      </div>

      {facts.length > 0 ? (
        <dl className="mt-7 grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          {facts.map((fact) => (
            <div key={fact.label} className="rounded-xl bg-sand-50 px-4 py-3">
              <dt className="text-base text-sand-600">{fact.label}</dt>
              <dd className="mt-0.5 font-serif text-2xl font-bold text-sand-900">{fact.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {flags.length > 0 ? (
        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          {flags.map((flag) => (
            <div
              key={flag.label}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3.5 ${FLAG_STYLES[flag.state]}`}
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
