import type { ReactNode } from "react";
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
  /** Report-level actions (PDF, refresh), shown right under the address. */
  actions?: ReactNode;
};

// Flag meaning rides on the icon and the value's colour, never on colour alone
// (ux: color-not-only): forest = clear, amber = something to check, mist = info.
const FLAG_DETAIL_STYLES: Record<SummaryFlag["state"], string> = {
  clear: "text-forest-800",
  present: "text-amber-900",
  info: "text-mist-800",
};

function FlagIcon({ state }: { state: SummaryFlag["state"] }) {
  if (state === "clear") return <CheckIcon className="h-6 w-6 shrink-0 text-forest-600" />;
  if (state === "present") return <WarningIcon className="h-6 w-6 shrink-0 text-amber-700" />;
  return <InfoIcon className="h-6 w-6 shrink-0 text-mist-500" />;
}

export function SummaryCard({ report, actions }: Props) {
  const { facts, flags } = buildSummary(report);
  const uniqueNumber = findParcelUniqueNumber(report);

  // No street address → honest label instead of a fabricated one, plus the
  // locality (village, eldership, municipality) so the reader still learns where
  // the parcel is. An administrative-area label in `address` is not a street
  // address either. The parcel centre powers both the secondary "Sklypo
  // centras" line (no-address case) and the Google Maps link; undefined when
  // the outline is unknown.
  const hasAddress = report.hasStreetAddress !== false && report.address.trim() !== "";
  const locality = !hasAddress ? report.locality : undefined;
  const center = parcelCenter(report);
  const mapsUrl = center
    ? `https://www.google.com/maps/search/?api=1&query=${center.lat},${center.lng}`
    : undefined;

  return (
    <section className="overflow-hidden rounded-2xl border border-mist-200 bg-white">
      <div className="grid gap-4 p-5">
        <div className="grid gap-1">
          <h1 className="font-display text-2xl font-bold leading-tight tracking-tight text-mist-900">
            {hasAddress ? report.address : "Žemės sklypas be priskirto adreso"}
          </h1>
          {locality ? <p className="text-lg font-semibold text-mist-800">Vietovė: {locality}</p> : null}
          <dl className="mt-1 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 text-base text-mist-600">
            <dt>Kadastrinis Nr.</dt>
            <dd className="font-semibold text-mist-900 tabular-nums">{report.cadastralRegNo}</dd>
            {uniqueNumber ? (
              <>
                <dt>Unikalus Nr.</dt>
                <dd className="font-semibold text-mist-900 tabular-nums">{uniqueNumber}</dd>
              </>
            ) : null}
            {report.hasStreetAddress === false && center ? (
              <>
                <dt>Sklypo centras</dt>
                <dd className="tabular-nums text-mist-900">
                  {center.lat.toFixed(5)}, {center.lng.toFixed(5)}
                </dd>
              </>
            ) : null}
          </dl>
          {mapsUrl ? (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-md text-base font-semibold text-forest-700 underline decoration-forest-300 underline-offset-4 transition-colors hover:text-forest-900 hover:decoration-forest-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600"
            >
              <PinIcon className="h-5 w-5 shrink-0" />
              Žemėlapyje (Google)
            </a>
          ) : null}
        </div>

        {actions}
      </div>

      {facts.length > 0 ? (
        <dl className="divide-y divide-mist-200 border-t border-mist-200 px-5">
          {facts.map((fact) => (
            <div key={fact.label} className="flex items-baseline justify-between gap-4 py-2.5">
              <dt className="text-base text-mist-600">{fact.label}</dt>
              <dd className="text-right text-lg font-semibold text-mist-900 tabular-nums">{fact.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {flags.length > 0 ? (
        <ul className="divide-y divide-mist-200 border-t border-mist-200">
          {flags.map((flag) => {
            const body = (
              <>
                <FlagIcon state={flag.state} />
                {/* Label and value keep their own columns; a long value wraps
                    inside its column, beside its label, never under it. */}
                <span className="grid min-w-0 flex-1 grid-cols-[minmax(min-content,1fr)_minmax(min-content,auto)] items-baseline gap-x-3 text-base">
                  <span className="text-mist-800">{flag.label}</span>
                  <span className={`max-w-44 text-right font-semibold ${FLAG_DETAIL_STYLES[flag.state]}`}>
                    {flag.detail}
                  </span>
                </span>
                {flag.panelKey ? <ChevronRight className="h-5 w-5 shrink-0 text-mist-500" /> : null}
              </>
            );

            // Rows that need a closer look keep a quiet amber wash, so they
            // stand out on a scan the way the old status tiles did.
            return (
              <li key={flag.label} className={flag.state === "present" ? "bg-amber-50" : undefined}>
                {flag.panelKey ? (
                  <button
                    type="button"
                    onClick={() => revealPanel(flag.panelKey!)}
                    className="flex min-h-12 w-full items-center gap-3 px-5 py-2.5 text-left transition-colors hover:bg-mist-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-forest-600 active:bg-mist-200"
                  >
                    {body}
                  </button>
                ) : (
                  <div className="flex min-h-12 items-center gap-3 px-5 py-2.5">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
