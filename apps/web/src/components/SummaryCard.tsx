import type { ParcelReport } from "@zeme/shared";
import { buildSummary, findParcelUniqueNumber, parcelCenter, type SummaryFlag } from "../lib/report-format";
import { CheckIcon, ChevronRight, InfoIcon, PinIcon, WarningIcon } from "./icons";

// Smoothly bring the related detailed panel into view (and open it if it is a
// collapsible <details>), so a summary flag like "Taršos rizika · Yra (1)" jumps
// the reader straight to the underlying records.
function revealPanel(panelKey: string) {
  const el = document.getElementById(`panel-${panelKey}`);
  if (!el) return;
  if (el instanceof HTMLDetailsElement) el.open = true;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}

type Props = {
  report: ParcelReport;
};

// Flag colours map to meaning, never decoration: forest = clear/positive,
// amber = something present to check, mist = neutral/info. Each also carries an
// icon so meaning never rests on colour alone (ux: color-not-only).
const FLAG_STYLES: Record<SummaryFlag["state"], string> = {
  clear: "border-forest-200 bg-forest-50 text-forest-800",
  present: "border-amber-200 bg-amber-50 text-amber-900",
  info: "border-mist-200 bg-mist-50 text-mist-800",
};

function FlagIcon({ state }: { state: SummaryFlag["state"] }) {
  if (state === "clear") return <CheckIcon className="h-6 w-6 shrink-0 text-forest-600" />;
  if (state === "present") return <WarningIcon className="h-6 w-6 shrink-0 text-amber-700" />;
  return <InfoIcon className="h-6 w-6 shrink-0 text-mist-500" />;
}

export function SummaryCard({ report }: Props) {
  const { facts, flags } = buildSummary(report);
  const uniqueNumber = findParcelUniqueNumber(report);

  // No street address → honest label instead of a fabricated one. The parcel
  // centre powers both the secondary "Sklypo centras" line (no-address case) and
  // the Google Maps link; undefined when the outline is unknown.
  const hasAddress = report.address.trim() !== "";
  const center = parcelCenter(report);
  const mapsUrl = center
    ? `https://www.google.com/maps/search/?api=1&query=${center.lat},${center.lng}`
    : undefined;

  return (
    <section className="overflow-hidden rounded-3xl border border-mist-200 bg-white shadow-soft">
      {/* Header band — emerald wash ties the address to the brand. */}
      <div className="flex flex-col gap-4 border-b border-mist-200 bg-linear-to-br from-forest-50 to-lime-50/50 px-6 py-6 sm:flex-row sm:items-start sm:justify-between md:px-8">
        <div className="min-w-0">
          <p className="text-base font-semibold uppercase tracking-wide text-forest-700">
            Sklypo apžvalga
          </p>
          <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-mist-900 md:text-3xl">
            {hasAddress ? report.address : "Žemės sklypas be priskirto adreso"}
          </h2>
          <p className="mt-1 text-lg text-mist-600">Kadastrinis Nr. {report.cadastralRegNo}</p>
          {uniqueNumber ? (
            <p className="text-lg text-mist-600">Unikalus Nr. {uniqueNumber}</p>
          ) : null}
          {report.hasStreetAddress === false && center ? (
            <p className="mt-1 text-base text-mist-500">
              Sklypo centras: {center.lat.toFixed(5)}, {center.lng.toFixed(5)}
            </p>
          ) : null}
        </div>

        {mapsUrl ? (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-2 rounded-2xl border border-forest-200 bg-white px-5 py-3 text-lg font-semibold text-forest-700 shadow-sm transition hover:-translate-y-0.5 hover:border-forest-300 hover:shadow-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600"
          >
            <PinIcon className="h-5 w-5 shrink-0" />
            Žemėlapyje (Google)
          </a>
        ) : null}
      </div>

      <div className="p-6 md:p-8">
        {facts.length > 0 ? (
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {facts.map((fact) => (
              <div
                key={fact.label}
                className="rounded-2xl border border-mist-200 bg-mist-50 px-5 py-4 transition hover:border-forest-200"
              >
                <dt className="text-base text-mist-500">{fact.label}</dt>
                <dd className="mt-1 font-display text-2xl font-bold tracking-tight text-mist-900">
                  {fact.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}

        {flags.length > 0 ? (
          <div className={`grid gap-3 sm:grid-cols-2 ${facts.length > 0 ? "mt-3" : ""}`}>
            {flags.map((flag) => {
              const base = `flex items-center gap-3 rounded-2xl border px-5 py-4 ${FLAG_STYLES[flag.state]}`;
              const body = (
                <>
                  <FlagIcon state={flag.state} />
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-medium leading-tight">{flag.label}</p>
                    <p className="text-lg font-bold leading-tight">{flag.detail}</p>
                  </div>
                  {flag.panelKey ? (
                    <ChevronRight className="h-5 w-5 shrink-0 opacity-60" />
                  ) : null}
                </>
              );

              return flag.panelKey ? (
                <button
                  key={flag.label}
                  type="button"
                  onClick={() => revealPanel(flag.panelKey!)}
                  className={`${base} w-full text-left transition hover:-translate-y-0.5 hover:shadow-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600`}
                >
                  {body}
                </button>
              ) : (
                <div key={flag.label} className={base}>
                  {body}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </section>
  );
}
