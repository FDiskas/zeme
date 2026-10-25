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

// Flag meaning rides on the icon and the row, never on colour alone
// (ux: color-not-only): a check = clear, a rust warning on a soft rust row =
// something to check, an info mark = for reference.
function FlagIcon({ state }: { state: SummaryFlag["state"] }) {
  if (state === "clear") return <CheckIcon className="h-6 w-6 shrink-0 text-ink" />;
  if (state === "present") return <WarningIcon className="h-6 w-6 shrink-0 text-accent" />;
  return <InfoIcon className="h-6 w-6 shrink-0 text-muted" />;
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
    <section className="card">
      <div className="grid gap-6 p-6">
        <div className="grid gap-3">
          <h1 className="text-xl leading-[1.15]">
            {hasAddress ? report.address : "Žemės sklypas be priskirto adreso"}
          </h1>
          {locality ? <p className="text-md font-medium text-ink">Vietovė: {locality}</p> : null}
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-4 gap-y-1 text-sm text-muted">
            <dt>Kadastrinis Nr.</dt>
            <dd className="code text-md text-accent">{report.cadastralRegNo}</dd>
            {uniqueNumber ? (
              <>
                <dt>Unikalus Nr.</dt>
                <dd className="code text-md text-ink">{uniqueNumber}</dd>
              </>
            ) : null}
            {report.hasStreetAddress === false && center ? (
              <>
                <dt>Sklypo centras</dt>
                <dd className="code text-md text-ink">
                  {center.lat.toFixed(5)}, {center.lng.toFixed(5)}
                </dd>
              </>
            ) : null}
          </dl>
          {mapsUrl ? (
            <a href={mapsUrl} target="_blank" rel="noreferrer" className="link inline-flex w-fit items-center gap-2 whitespace-nowrap text-sm">
              <PinIcon className="h-5 w-5 shrink-0" />
              Žemėlapyje (Google)
            </a>
          ) : null}
        </div>

        {actions}
      </div>

      {facts.length > 0 ? (
        <dl className="spec mx-6">
          {facts.map((fact) => (
            <div key={fact.label} className="flex items-baseline justify-between gap-4 py-3">
              <dt className="text-sm text-muted">{fact.label}</dt>
              <dd className="text-right text-md font-medium text-ink tabular-nums">{fact.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {flags.length > 0 ? (
        <ul className="spec mt-2">
          {flags.map((flag) => {
            const body = (
              <>
                <FlagIcon state={flag.state} />
                {/* From sm up, label and value keep their own columns and a long
                    value wraps inside its column; on a phone the value sits
                    on its own line under the label, so neither is squeezed. */}
                <span className="grid min-w-0 flex-1 grid-cols-1 items-baseline gap-x-3 text-md sm:grid-cols-[minmax(min-content,1fr)_minmax(min-content,auto)]">
                  <span className="text-ink">{flag.label}</span>
                  <span className="font-medium text-ink sm:max-w-44 sm:text-right">{flag.detail}</span>
                </span>
                {flag.panelKey ? <ChevronRight className="h-5 w-5 shrink-0 text-ink" /> : null}
              </>
            );

            // Rows that need a closer look keep a soft rust wash, so they
            // stand out on a scan.
            return (
              <li key={flag.label} className={flag.state === "present" ? "bg-accent-soft" : undefined}>
                {flag.panelKey ? (
                  <button
                    type="button"
                    onClick={() => revealPanel(flag.panelKey!)}
                    className="flex min-h-14 w-full items-center gap-3 px-6 py-3 text-left transition-colors duration-150 hover:bg-paper-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus active:bg-paper-3"
                  >
                    {body}
                  </button>
                ) : (
                  <div className="flex min-h-14 items-center gap-3 px-6 py-3">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
