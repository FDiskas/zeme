import { useEffect, useState } from "react";
import { REPORT_PANEL_KEYS, ltCount, type ParcelReport, type ReportPanelKey } from "@zeme/shared";
import { panelTitle } from "../lib/report-format";
import type { PanelRetry, ReportStatus } from "../lib/useParcelReport";
import { CheckIcon, CloseIcon, RefreshIcon, WarningIcon } from "./icons";

type StepState = "loading" | "ok" | "error";
type Step = { key: string; label: string; state: StepState; reason?: string; retryKey?: ReportPanelKey };
type Phase = "loading" | "settled";

// A cached report arrives in well under this; only a slower answer shows the
// note, so a quick one doesn't flash it.
const SHOW_AFTER_MS = 600;
// How long "everything came" stays before the note goes by itself.
const ALL_RECEIVED_MS = 3000;
const LOST_REASON = "nepavyko gauti atsakymo iš serverio";
const SOURCE_FORMS: [string, string, string] = ["šaltinio", "šaltinių", "šaltinių"];

// The parcel lookup first, then one step per panel. A step still out when the
// stream broke off counts as failed.
function stepsOf(report: ParcelReport | null, status: ReportStatus): Step[] {
  const lost = status === "failed";
  const parcel: Step = {
    key: "parcel",
    label: "Sklypo paieška registruose",
    state: report ? "ok" : lost ? "error" : "loading",
    reason: !report && lost ? LOST_REASON : undefined,
  };
  const panels = REPORT_PANEL_KEYS.map((key): Step => {
    const label = panelTitle(key);
    const panel = report?.reportPanels.find((p) => p.key === key);
    if (!panel) return { key, label, state: lost ? "error" : "loading", reason: lost ? LOST_REASON : undefined };
    // As in the report: a partial answer with nothing in it is a failure.
    const failed = panel.status === "error" || (panel.status === "partial" && panel.items.length === 0);
    return failed ? { key, label, state: "error", reason: panel.note, retryKey: key } : { key, label, state: "ok" };
  });
  return [parcel, ...panels];
}

const SPOKEN: Record<StepState, string> = { loading: "kraunama", ok: "gauta", error: "nepavyko" };

function StepMark({ state }: { state: StepState }) {
  if (state === "ok") return <CheckIcon className="h-5 w-5 shrink-0 text-green" />;
  if (state === "error") return <WarningIcon className="h-5 w-5 shrink-0 text-warn" />;
  // As wide as the icons, so the labels stay put when a row turns.
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center" aria-hidden="true">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-paper-3 border-t-ink motion-reduce:animate-none" />
    </span>
  );
}

function StepList({ steps, retrying }: { steps: Step[]; retrying: ReadonlySet<string> }) {
  return (
    <ul className="max-h-[min(20rem,40dvh)] overflow-y-auto border-y border-rule">
      {steps.map((step) => {
        const state = step.retryKey && retrying.has(step.retryKey) ? "loading" : step.state;
        return (
          <li key={step.key} className="flex items-start gap-3 border-b border-rule py-2 last:border-b-0">
            <StepMark state={state} />
            <div className="grid min-w-0 flex-1 gap-0.5">
              <span className="text-md">
                {step.label}
                <span className="sr-only">: {SPOKEN[state]}</span>
              </span>
              {state === "error" && step.reason ? (
                <span className="text-sm text-muted">Priežastis: {step.reason}</span>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

type Props = {
  report: ParcelReport | null;
  status: ReportStatus;
  /** True when the report is being built from the sources, not read from the cache. */
  rebuilt: boolean;
  /** Ask a failed source again; absent while the report is still being built. */
  retry?: PanelRetry;
  /** Load the whole report again, for when the connection broke off. */
  onReload: () => void;
};

/**
 * A note in the screen's corner while a new report is built, so the report
 * itself stays in view and fills in beside it. It counts the sources that
 * have answered and goes by itself once all have; when some failed it stays,
 * listing them with their reasons, until the reader asks them again or
 * closes it. Remount it (key) for each load.
 */
export function ReportProgress({ report, status, rebuilt, retry, onReload }: Props) {
  const [delayPassed, setDelayPassed] = useState(false);
  const [dismissedIn, setDismissedIn] = useState<Phase | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [allReceivedShown, setAllReceivedShown] = useState(false);

  const loading = status === "loading";
  const phase: Phase = loading ? "loading" : "settled";
  // On a refresh the previous report stays on the page until the new build
  // starts; its panels are not this load's answers.
  const steps = stepsOf(loading && !rebuilt ? null : report, status);
  const answered = steps.filter((step) => step.state !== "loading").length;
  const failures = steps.filter((step) => step.state === "error");
  const allReceived = !loading && failures.length === 0;

  useEffect(() => {
    const timer = setTimeout(() => setDelayPassed(true), SHOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!allReceived) return;
    const timer = setTimeout(() => setAllReceivedShown(true), ALL_RECEIVED_MS);
    return () => clearTimeout(timer);
  }, [allReceived]);

  // Shown only for a build that takes a while. Closing it while it loads
  // hides the count, not a failure that comes later. Without any report the
  // page itself says so, with its own key to try again.
  const started = rebuilt || (delayPassed && loading);
  const worthShowing =
    loading ||
    (failures.length > 0 && (rebuilt || status === "failed")) ||
    (allReceived && rebuilt && !allReceivedShown && dismissedIn === null);
  const pageReportsFailure = !report && status === "failed";
  const visible = started && worthShowing && dismissedIn !== phase && !pageReportsFailure;
  if (!visible) return null;

  const total = ltCount(steps.length, SOURCE_FORMS);
  const retrying = retry?.retrying ?? new Set<string>();
  const retryKeys = failures.flatMap((step) => (step.retryKey ? [step.retryKey] : []));
  const busy = retryKeys.some((key) => retrying.has(key));
  // A broken stream is read again whole; a saved report asks only the failed sources.
  const onTryAgain =
    status === "failed" ? onReload : retry ? () => retryKeys.forEach((key) => retry.onRetry(key)) : undefined;

  const title = loading ? "Renkame sklypo duomenis" : allReceived ? "Visi duomenys gauti" : "Ne visi šaltiniai atsakė";
  const summary =
    loading || allReceived
      ? `Gauta ${answered} iš ${total}`
      : `Nepavyko gauti ${failures.length} iš ${total}. Kitus duomenis jau matote ataskaitoje.`;

  return (
    <section
      aria-labelledby="report-progress-title"
      className="fixed inset-x-4 bottom-4 z-1100 grid gap-3 rounded-entry border border-rule bg-plate p-4 text-ink shadow-lift sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-104"
    >
      <header className="flex items-start gap-3">
        <span className="mt-1">
          <StepMark state={loading ? "loading" : allReceived ? "ok" : "error"} />
        </span>
        <div className="grid min-w-0 flex-1 gap-0.5">
          <h2 id="report-progress-title" className="text-lg tracking-[-0.02em]" aria-live="polite">
            {title}
          </h2>
          <p className="text-sm text-ink-2">{summary}</p>
        </div>
        <button
          type="button"
          onClick={() => setDismissedIn(phase)}
          className="btn btn--secondary btn--icon -mt-1 -mr-1 shrink-0"
          aria-label="Užverti pranešimą"
        >
          <CloseIcon className="h-5 w-5" />
        </button>
      </header>

      {loading ? (
        <>
          <div
            className="h-2 overflow-hidden rounded-pill bg-paper-2"
            role="progressbar"
            aria-label="Atsakę šaltiniai"
            aria-valuemin={0}
            aria-valuemax={steps.length}
            aria-valuenow={answered}
          >
            <span
              className="block h-full rounded-pill bg-accent transition-[width] duration-300 motion-reduce:transition-none"
              style={{ width: `${(answered / steps.length) * 100}%` }}
            />
          </div>
          <button
            type="button"
            onClick={() => setExpanded((open) => !open)}
            aria-expanded={expanded}
            className="link min-h-11 w-fit text-sm"
          >
            {expanded ? "Slėpti šaltinius" : "Rodyti šaltinius"}
          </button>
          {expanded ? <StepList steps={steps} retrying={retrying} /> : null}
        </>
      ) : null}

      {!loading && failures.length > 0 ? (
        <>
          <StepList steps={failures} retrying={retrying} />
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => setDismissedIn(phase)} className="btn btn--secondary btn--s">
              Užverti
            </button>
            {onTryAgain ? (
              <button type="button" onClick={onTryAgain} disabled={busy} aria-busy={busy} className="btn btn--s">
                <RefreshIcon className={`h-5 w-5${busy ? " animate-spin motion-reduce:animate-none" : ""}`} />
                {busy ? "Bandoma…" : "Bandyti dar kartą"}
              </button>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  );
}
