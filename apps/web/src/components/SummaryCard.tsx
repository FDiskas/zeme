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
  /** Report-level actions (PDF, refresh), shown at the foot of the card. */
  actions?: ReactNode;
};

// Flag meaning rides on the chip's icon and word, never on colour alone
// (ux: color-not-only): a check = clear, a warning on a tangerine fill =
// something to check, an info mark = for reference.
function FlagChip({ flag }: { flag: SummaryFlag }) {
  const tone = flag.state === "clear" ? " chip--clear" : flag.state === "present" ? " chip--present" : "";
  const Icon = flag.state === "clear" ? CheckIcon : flag.state === "present" ? WarningIcon : InfoIcon;
  return (
    <span className={`chip${tone} max-w-60 py-1.5 whitespace-normal`}>
      <Icon className="h-4 w-4 shrink-0" />
      {flag.detail}
    </span>
  );
}

// Numbers that get copied and retyped never break inside themselves: a pair
// may wrap only after its comma.
function Unbroken({ parts }: { parts: string[] }) {
  return (
    <>
      {parts.map((part, i) => (
        <span key={i} className="whitespace-nowrap">
          {part}
          {i < parts.length - 1 ? ", " : null}
        </span>
      ))}
    </>
  );
}

type Cell = { label: string; value: ReactNode; hint?: string; code?: boolean };

export function SummaryCard({ report, actions }: Props) {
  const { facts, flags } = buildSummary(report);
  const uniqueNumber = findParcelUniqueNumber(report);

  const [copied, setCopied] = useState(false);

  // No street address → honest label instead of a fabricated one, plus the
  // locality (village, eldership, municipality) so the reader still learns where
  // the parcel is. An administrative-area label in `address` is not a street
  // address either. The parcel centre powers the coordinate cells (WGS-84 for
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

  // The notebook cells: the summary facts first, then the numbers a surveyor
  // or a phone needs. An odd count lets the last cell span both columns, so no
  // cell sits alone on its row.
  const cells: Cell[] = [
    ...facts.map((fact) => ({ label: fact.label, value: fact.value, hint: fact.hint })),
    ...(uniqueNumber ? [{ label: "Unikalus Nr.", value: <Unbroken parts={[uniqueNumber]} />, code: true }] : []),
    ...(wgs && lks
      ? [
          {
            label: "Centras (WGS-84)",
            code: true,
            value: (
              <>
                <Unbroken parts={[center!.lat.toFixed(6), center!.lng.toFixed(6)]} />
                <button type="button" onClick={copyCoordinates} className="link mt-1 flex w-fit items-center gap-1.5 font-body text-sm">
                  <CopyIcon className="h-4 w-4 shrink-0" />
                  <span aria-live="polite">{copied ? "Nukopijuota" : "Kopijuoti"}</span>
                </button>
              </>
            ),
          },
          { label: "Centras (LKS-94)", code: true, value: <Unbroken parts={[lks.x.toFixed(2), lks.y.toFixed(2)]} /> },
        ]
      : []),
  ];

  return (
    <>
      <article className="entry" aria-labelledby="parcel-title">
        {/* The ink head: the parcel's cadastral number, the one a reader searched by. */}
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 bg-ink px-5 py-3 text-paper">
          <span className="text-sm font-medium">Kadastrinis Nr.</span>
          <span className="code text-md">{report.cadastralRegNo}</span>
        </div>

        <div className="grid gap-2 px-5 pt-5 pb-4">
          <h1 id="parcel-title" className="text-xl leading-[1.15] tracking-[-0.02em]">
            {hasAddress ? report.address : "Žemės sklypas be priskirto adreso"}
          </h1>
          {locality ? <p className="text-md text-ink-2">Vietovė: {locality}</p> : null}
          {mapLinks.length > 0 ? (
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
              <span className="inline-flex items-center gap-1.5">
                <PinIcon className="h-4 w-4 shrink-0" />
                Atidaryti:
              </span>
              {mapLinks.map((link) => (
                <a key={link.name} href={link.href} target="_blank" rel="noreferrer" className="link whitespace-nowrap">
                  {link.name}
                </a>
              ))}
            </p>
          ) : null}
        </div>

        {cells.length > 0 ? (
          <dl className="cells">
            {cells.map((cell, i) => (
              <div key={cell.label} className={cells.length % 2 === 1 && i === cells.length - 1 ? "cells__wide" : undefined}>
                <dt className="text-sm text-muted">{cell.label}</dt>
                <dd className={`m-0 text-md font-medium text-ink tabular-nums wrap-break-word${cell.code ? " code" : ""}`}>
                  {cell.value}
                  {cell.hint ? <span className="block text-sm font-normal text-ink-2">{cell.hint}</span> : null}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}

        {actions ? <div className="p-5">{actions}</div> : null}
      </article>

      {flags.length > 0 ? (
        <section aria-labelledby="checks-title" className="grid gap-3">
          <h2 id="checks-title" className="text-title">Ką verta patikrinti</h2>
          <ul className="spec">
            {flags.map((flag) => {
              const body = (
                <>
                  {/* On a phone the chip always sits under its label, so every
                      row reads the same way and neither is squeezed. */}
                  <span className="flex min-w-0 flex-1 flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                    <span className="text-md text-ink">{flag.label}</span>
                    <FlagChip flag={flag} />
                  </span>
                  {flag.panelKey ? <ChevronRight className="h-5 w-5 shrink-0 text-ink" /> : <span className="w-5 shrink-0" aria-hidden="true" />}
                </>
              );

              return (
                <li key={flag.label}>
                  {flag.panelKey ? (
                    <button
                      type="button"
                      onClick={() => revealPanel(flag.panelKey!)}
                      className="flex min-h-14 w-full items-center gap-3 rounded-pill px-2 py-2 text-left transition-colors duration-150 hover:bg-paper-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus active:bg-paper-3"
                    >
                      {body}
                    </button>
                  ) : (
                    <div className="flex min-h-14 items-center gap-3 px-2 py-2">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </>
  );
}
