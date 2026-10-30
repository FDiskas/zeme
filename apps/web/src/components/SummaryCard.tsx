import { Fragment, type ReactNode } from "react";
import { ltCount, type ParcelReport, type ReportPanelKey } from "@zeme/shared";
import {
  buildSummary,
  findParcelUniqueNumber,
  parcelCenter,
  type FactMeter,
  type FlagState,
  type SummaryFact,
  type SummaryFlag,
} from "../lib/report-format";
import { wgs84ToLks94 } from "../lib/geo";
import type { PanelRetry } from "../lib/useParcelReport";
import { CopyButton } from "./CopyButton";
import { InfoTip } from "./InfoTip";
import { CheckIcon, ChevronDown, ChevronRight, InfoIcon, PinIcon, RefreshIcon, WarningIcon } from "./icons";

// Smoothly bring the related detailed panel into view (and open it if it is a
// collapsible <details>), so a summary flag like "Taršos rizika · Rasta" jumps
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
  /** Panels still on their way while the report is built. */
  pending?: ReadonlySet<string>;
  /** Ask a failed source again, offered next to its fact. */
  retry?: PanelRetry;
};

// Flag meaning rides on the icon, its word and a spoken tone, never on
// colour alone (ux: color-not-only): a check on green = fine, a warning on
// brick red = worth a closer look, an info mark = look it up elsewhere.
const FLAG_TONES: Record<FlagState, { chip: string; badge: string; text: string; Icon: typeof CheckIcon; spoken: string }> = {
  good: { chip: " chip--clear", badge: "bg-green-soft text-green", text: "text-green", Icon: CheckIcon, spoken: "Gerai" },
  attention: { chip: " chip--present", badge: "bg-warn-soft text-warn", text: "text-warn", Icon: WarningIcon, spoken: "Dėmesio" },
  check: { chip: "", badge: "bg-paper-2 text-ink-2", text: "text-ink-2", Icon: InfoIcon, spoken: "Tikrinti" },
};

// Worries first, then what the report cannot tell, then what came back clear;
// within a tone the order the checks were written in.
const TONE_ORDER: Record<FlagState, number> = { attention: 0, check: 1, good: 2 };
const byTone = (flags: SummaryFlag[]) => [...flags].sort((a, b) => TONE_ORDER[a.state] - TONE_ORDER[b.state]);

// Numbers that get copied and retyped never break inside themselves: a pair
// may wrap only after its comma.
function Unbroken({ parts }: { parts: string[] }) {
  return (
    <>
      {/* The space after the comma sits outside the unbreakable span: that
          is where the pair may wrap. */}
      {parts.map((part, i) => (
        <Fragment key={i}>
          <span className="whitespace-nowrap">
            {part}
            {i < parts.length - 1 ? "," : null}
          </span>
          {i < parts.length - 1 ? " " : null}
        </Fragment>
      ))}
    </>
  );
}

type Cell = { label: string; value: ReactNode; hints?: string[]; meter?: FactMeter; code?: boolean };

// The value against its allowed maximum as a slim bar: green while within
// it, brick red past it. The numbers are spoken, and said in words only when
// the limit is passed; otherwise the info tip carries them.
function Meter({ meter }: { meter: FactMeter }) {
  const over = meter.value > meter.max;
  const width = `${Math.max(2, Math.min(100, (meter.value / meter.max) * 100))}%`;
  return (
    <span className="mt-2 grid gap-1 font-body">
      <span className="block h-1.5 overflow-hidden rounded-pill bg-paper-3" aria-hidden="true">
        <span className={`block h-full rounded-pill ${over ? "bg-warn" : "bg-green"}`} style={{ width }} />
      </span>
      {over ? (
        <span className="text-sm font-medium text-warn">Daugiau nei leidžia reglamentas</span>
      ) : (
        <span className="sr-only">{meter.label}</span>
      )}
    </span>
  );
}

// A label with its explanation one tap away, never under the value.
function Label({ cell, align }: { cell: Cell; align?: "start" | "end" }) {
  if (!cell.hints || cell.hints.length === 0) return <>{cell.label}</>;
  return (
    <InfoTip about={cell.label} lines={cell.hints} align={align}>
      {cell.label}
    </InfoTip>
  );
}

// The secondary facts as ruled rows, label left and value right: one line
// each, so the card stays short. A retry sits under its value.
function FactRows({ cells }: { cells: Cell[] }) {
  return (
    <dl>
      {cells.map((cell) => (
        <div key={cell.label} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-b border-rule px-5 py-2">
          <dt className="text-md text-ink-2"><Label cell={cell} /></dt>
          <dd className={`m-0 ml-auto text-right text-md font-medium text-ink tabular-nums${cell.code ? " code" : ""}`}>{cell.value}</dd>
          {cell.meter ? <span className="basis-full"><Meter meter={cell.meter} /></span> : null}
        </div>
      ))}
    </dl>
  );
}

// Notebook cells: label small and muted on top, the value beneath. An odd
// count lets the last cell span both columns, so no cell sits alone. A tip in
// the right column opens leftwards, so it stays on the card.
function Cells({ cells, size }: { cells: Cell[]; size: "large" | "regular" }) {
  return (
    <dl className="cells">
      {cells.map((cell, i) => (
        <div key={cell.label} className={cells.length % 2 === 1 && i === cells.length - 1 ? "cells__wide" : undefined}>
          <dt className="text-sm text-muted"><Label cell={cell} align={i % 2 === 1 ? "end" : "start"} /></dt>
          <dd
            className={`m-0 font-medium text-ink tabular-nums wrap-break-word ${size === "large" ? "text-xl leading-tight" : "text-md"}${cell.code ? " code" : ""}`}
          >
            {cell.value}
            {cell.meter ? <Meter meter={cell.meter} /> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

// Right under the address: the worries as compact tags, so they are seen
// before any number. Each worry gets its own tag; the rest is one tag that
// counts the checks with no remark. A worry jumps to its detailed panel; the
// count to the full list of checks under the card. What the report cannot
// tell ("tikrinti") waits in that list: it is in every report, so as a tag it
// would only dull the real worries.
function RiskTags({ flags }: { flags: SummaryFlag[] }) {
  const worries = flags.filter((flag) => flag.state === "attention");
  const clear = flags.filter((flag) => flag.state === "good").length;
  const tagClass = "chip min-h-9 whitespace-normal text-left transition-[filter] duration-150 hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";
  if (worries.length === 0 && clear === 0) return null;

  return (
    <div className="pt-1">
      <h2 className="sr-only">Rizikos</h2>
      <ul className="flex flex-wrap gap-2">
        {worries.map((flag) => {
          const { chip, Icon, spoken } = FLAG_TONES[flag.state];
          return (
            <li key={flag.label}>
              <button type="button" onClick={() => flag.panelKey && revealPanel(flag.panelKey)} className={`${tagClass}${chip}`}>
                <Icon className="h-4 w-4 shrink-0" />
                <span className="sr-only">{spoken}: </span>
                {flag.tag ?? flag.label}
              </button>
            </li>
          );
        })}
        {clear > 0 ? (
          <li>
            <a href="#checks-title" className={`${tagClass} chip--clear`}>
              <CheckIcon className="h-4 w-4 shrink-0" />
              {clear === flags.length ? "Rizikų nerasta" : `${ltCount(clear, ["patikrinimas", "patikrinimai", "patikrinimų"])} be pastabų`}
            </a>
          </li>
        ) : null}
      </ul>
    </div>
  );
}

function RetryLink({ panelKey, retry }: { panelKey: ReportPanelKey; retry: PanelRetry }) {
  const busy = retry.retrying.has(panelKey);
  return (
    <button
      type="button"
      onClick={() => retry.onRetry(panelKey)}
      disabled={busy}
      aria-busy={busy}
      className="link mt-1 ml-auto flex w-fit items-center gap-1.5 font-body text-sm"
    >
      <RefreshIcon className={`h-4 w-4 shrink-0${busy ? " animate-spin motion-reduce:animate-none" : ""}`} />
      {busy ? "Bandoma…" : "Bandyti dar kartą"}
    </button>
  );
}

export function SummaryCard({ report, actions, pending, retry }: Props) {
  const { facts, flags } = buildSummary(report, pending);
  const uniqueNumber = findParcelUniqueNumber(report);

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

  const toCell = (fact: SummaryFact): Cell => ({
    label: fact.label,
    hints: fact.hints,
    meter: fact.meter,
    value:
      fact.failedPanel && retry ? (
        <>
          <span className="text-ink-2">{fact.value}</span>
          <RetryLink panelKey={fact.failedPanel} retry={retry} />
        </>
      ) : (
        fact.value
      ),
  });

  // Three tiers: the few numbers a buyer came for, large; the rest of the
  // facts as one-line rows; the identifiers and coordinates a surveyor or a
  // phone needs folded away under "Techniniai duomenys".
  const keyCells = facts.filter((fact) => fact.primary).map(toCell);
  const moreCells = facts.filter((fact) => !fact.primary).map(toCell);
  const technicalCells: Cell[] = [
    ...(uniqueNumber ? [{ label: "Unikalus Nr.", value: <Unbroken parts={[uniqueNumber]} />, code: true }] : []),
    ...(wgs && lks
      ? [
          {
            label: "Centras (WGS-84)",
            code: true,
            value: (
              <>
                <Unbroken parts={[center!.lat.toFixed(6), center!.lng.toFixed(6)]} />
                <CopyButton text={wgs} label="Kopijuoti koordinates" className="link mt-1 flex" />
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
        {/* People know a parcel by its address, so it heads the card; the
            cadastral number follows on its own line, ready to copy. */}
        <div className="grid gap-2 px-5 pt-5 pb-4">
          <h1 id="parcel-title" className="text-xl leading-[1.15] tracking-[-0.02em]">
            {hasAddress ? report.address : "Žemės sklypas be priskirto adreso"}
          </h1>
          {locality ? <p className="text-md text-ink-2">Vietovė: {locality}</p> : null}
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-2">
            <span>Kadastrinis Nr.</span>
            <span className="code text-md text-ink">{report.cadastralRegNo}</span>
            <CopyButton text={report.cadastralRegNo} label="Kopijuoti kadastrinį numerį" />
          </p>
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
          {flags.length > 0 ? <RiskTags flags={flags} /> : null}
        </div>

        {keyCells.length > 0 ? <Cells cells={keyCells} size="large" /> : null}
        {moreCells.length > 0 ? <FactRows cells={moreCells} /> : null}

        {technicalCells.length > 0 ? (
          <details className="report-disclosure border-b border-rule">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-5 py-2 text-md text-ink-2 transition-colors duration-150 hover:bg-paper-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus">
              Techniniai duomenys
              <ChevronDown className="report-chevron h-5 w-5 shrink-0" />
            </summary>
            <Cells cells={technicalCells} size="regular" />
          </details>
        ) : null}

        {actions ? <div className="px-5 pt-4 pb-2">{actions}</div> : null}
      </article>

      {flags.length > 0 ? (
        <section aria-labelledby="checks-title" className="grid gap-2">
          <h2 id="checks-title" className="text-title">Svarbiausia trumpai</h2>
          <ul className="spec">
            {byTone(flags).map((flag) => {
              const { badge, text, Icon, spoken } = FLAG_TONES[flag.state];
              const noteId = `flag-note-${flag.panelKey ?? flag.label}`;
              // One ruled row: the tone as a round mark, the check, its answer
              // in a word or two, the way to the detail. The longer answer
              // opens on hover and focus; a tap goes to the detail, where the
              // panel says it in full.
              const body = (
                <>
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${badge}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1 text-md text-ink">{flag.label}</span>
                  <span className={`shrink-0 text-right text-sm font-medium ${text}`}>
                    <span className="sr-only">{spoken}: </span>
                    {flag.detail}
                  </span>
                  {flag.panelKey ? <ChevronRight className="h-5 w-5 shrink-0 text-muted" /> : <span className="w-5 shrink-0" aria-hidden="true" />}
                </>
              );
              const rowClass = "flex min-h-12 w-full items-center gap-3 px-2 py-1.5 text-left";

              return (
                <li key={flag.label} className="tip tip--end grid">
                  {flag.panelKey ? (
                    <button
                      type="button"
                      onClick={() => revealPanel(flag.panelKey!)}
                      aria-describedby={flag.note ? noteId : undefined}
                      className={`${rowClass} transition-colors duration-150 hover:bg-paper-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus active:bg-paper-3`}
                    >
                      {body}
                    </button>
                  ) : (
                    <div className={rowClass}>{body}</div>
                  )}
                  {flag.note ? (
                    <span id={noteId} role="tooltip" className="tip__bubble">
                      {flag.note}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </>
  );
}
