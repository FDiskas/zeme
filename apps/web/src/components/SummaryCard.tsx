import { useState, type ReactNode } from "react";
import type { ParcelReport } from "@zeme/shared";
import { buildSummary, findParcelUniqueNumber, parcelCenter, type SummaryFlag } from "../lib/report-format";
import { wgs84ToLks94 } from "../lib/geo";
import { CheckIcon, ChevronRight, CopyIcon, InfoIcon, PinIcon, WarningIcon } from "./icons";

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

  const [copied, setCopied] = useState(false);

  // No street address → honest label instead of a fabricated one, plus the
  // locality (village, eldership, municipality) so the reader still learns where
  // the parcel is. An administrative-area label in `address` is not a street
  // address either. The parcel centre powers the coordinate rows (WGS-84 for
  // phones and maps, LKS-94 for surveyors and the cadastre) and the navigation
  // links; undefined when the outline is unknown.
  const hasAddress = report.hasStreetAddress !== false && report.address.trim() !== "";
  const locality = !hasAddress ? report.locality : undefined;
  const center = parcelCenter(report);
  const wgs = center ? `${center.lat.toFixed(6)}, ${center.lng.toFixed(6)}` : undefined;
  const lks = center ? wgs84ToLks94(center.lng, center.lat) : undefined;
  const mapLinks = center
    ? [
        { name: "Google", href: `https://www.google.com/maps/search/?api=1&query=${center.lat},${center.lng}` },
        { name: "Apple", href: `https://maps.apple.com/?ll=${center.lat},${center.lng}&q=${encodeURIComponent(report.cadastralRegNo)}` },
        { name: "Waze", href: `https://waze.com/ul?ll=${center.lat},${center.lng}&navigate=yes` },
      ]
    : [];

  async function copyCoordinates() {
    if (!wgs) return;
    try {
      await navigator.clipboard.writeText(wgs);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (insecure context, denied permission): the
      // coordinates stay on screen to copy by hand.
    }
  }

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
            {wgs && lks ? (
              <>
                <dt>Centras (WGS-84)</dt>
                <dd className="code text-md text-ink">{wgs}</dd>
                <dt>Centras (LKS-94)</dt>
                <dd className="code text-md text-ink">
                  {lks.x.toFixed(2)}, {lks.y.toFixed(2)}
                </dd>
              </>
            ) : null}
          </dl>
          {mapLinks.length > 0 ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              <span className="inline-flex items-center gap-2 text-muted">
                <PinIcon className="h-5 w-5 shrink-0" />
                Atidaryti:
              </span>
              {mapLinks.map((link) => (
                <a key={link.name} href={link.href} target="_blank" rel="noreferrer" className="link whitespace-nowrap">
                  {link.name}
                </a>
              ))}
              <button type="button" onClick={copyCoordinates} className="link inline-flex items-center gap-1.5 whitespace-nowrap">
                <CopyIcon className="h-4 w-4 shrink-0" />
                <span aria-live="polite">{copied ? "Nukopijuota" : "Kopijuoti koordinates"}</span>
              </button>
            </div>
          ) : null}
        </div>

        {actions}
      </div>

      {facts.length > 0 ? (
        <dl className="spec mx-6">
          {facts.map((fact) => (
            <div key={fact.label} className="flex items-baseline justify-between gap-4 py-3">
              <dt className="text-sm text-muted">{fact.label}</dt>
              <dd className="text-right text-md font-medium text-ink tabular-nums">
                {fact.value}
                {fact.hint ? <span className="block text-sm font-normal text-ink-2">{fact.hint}</span> : null}
              </dd>
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
