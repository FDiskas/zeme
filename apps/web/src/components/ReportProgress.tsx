import { useEffect, useRef, useState } from "react";
import { REPORT_PANEL_KEYS, ltCount, type ParcelReport, type ReportPanelKey } from "@zeme/shared";
import { panelTitle } from "../lib/report-format";
import type { PanelRetry, ReportStatus } from "../lib/useParcelReport";
import { CheckIcon, CloseIcon, RefreshIcon, WarningIcon } from "./icons";

type StepState = "loading" | "ok" | "error";
type Step = { key: string; label: string; state: StepState; reason?: string; retryKey?: ReportPanelKey };

// A cached report arrives in well under this; only a slower answer opens the
// window, so a quick one doesn't flash it.
const SHOW_AFTER_MS = 600;
const LOST_REASON = "nepavyko gauti atsakymo iš serverio";

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
 * While a new report is built: a window listing every source and whether it
 * has answered, then the ones that failed, each with its reason and a key to
 * ask it again. Closed, it leaves a one-line note on the page that opens it
 * again. Remount it (key) for each load.
 */
export function ReportProgress({ report, status, rebuilt, retry, onReload }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [delayPassed, setDelayPassed] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDelayPassed(true), SHOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);

  const loading = status === "loading";
  const steps = stepsOf(report, status);
  const answered = steps.filter((step) => step.state !== "loading").length;
  const failures = steps.filter((step) => step.state === "error");
  const received = steps.filter((step) => step.state === "ok").length;
  // Shown only for a build that takes a while; it stays after the build only
  // to show what failed, and closes by itself when everything came.
  const shown = rebuilt || (delayPassed && loading);
  const worthShowing = loading || (failures.length > 0 && (rebuilt || status === "failed"));
  const open = shown && worthShowing && !dismissed;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  if (!shown || !worthShowing) return null;

  // Failures lead once everything has answered; while loading the order
  // stays put, so rows don't jump as they turn green.
  const ordered = loading ? steps : [...failures, ...steps.filter((step) => step.state !== "error")];
  const total = ltCount(steps.length, ["šaltinio", "šaltinių", "šaltinių"]);

  return (
    <>
      <dialog
        ref={dialogRef}
        aria-labelledby="report-progress-title"
        onCancel={(event) => {
          event.preventDefault();
          setDismissed(true);
        }}
        className="m-auto max-h-[calc(100dvh-2rem)] w-[min(34rem,calc(100vw-2rem))] overflow-hidden rounded-entry bg-plate p-0 text-ink shadow-lift backdrop:bg-ink/40"
      >
        <div className="flex max-h-[calc(100dvh-2rem)] flex-col gap-4 p-6 max-sm:p-5">
          <header className="flex items-start justify-between gap-4">
            <div className="grid gap-1">
              <h2 id="report-progress-title" className="text-xl tracking-[-0.02em]" aria-live="polite">
                {loading ? "Renkame sklypo duomenis" : "Ne visi šaltiniai atsakė"}
              </h2>
              <p className="text-md text-ink-2">
                {loading
                  ? `Gauta ${answered} iš ${total}. Pirmą kartą tai gali užtrukti iki minutės, vėliau ataskaita atsidarys iš karto.`
                  : `Gauta ${received} iš ${total}. Ataskaitą jau galite peržiūrėti, o nepavykusius šaltinius bandyti dar kartą.`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="btn btn--secondary btn--icon shrink-0"
              aria-label="Uždaryti"
            >
              <CloseIcon className="h-5 w-5" />
            </button>
          </header>

          <div
            className="h-2 shrink-0 overflow-hidden rounded-pill bg-paper-2"
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

          <ul className="min-h-0 flex-1 overflow-y-auto border-y border-rule">
            {ordered.map((step) => {
              const retryKey = step.state === "error" ? step.retryKey : undefined;
              const busy = retryKey ? (retry?.retrying.has(retryKey) ?? false) : false;
              return (
                <li key={step.key} className="flex items-start gap-3 border-b border-rule py-2.5 last:border-b-0">
                  <StepMark state={step.state} />
                  <div className="grid min-w-0 flex-1 gap-0.5">
                    <span className="text-md">
                      {step.label}
                      <span className="sr-only">: {SPOKEN[step.state]}</span>
                    </span>
                    {step.state === "error" && step.reason ? (
                      <span className="text-sm text-muted">Priežastis: {step.reason}</span>
                    ) : null}
                  </div>
                  {retryKey && retry ? (
                    <button
                      type="button"
                      onClick={() => retry.onRetry(retryKey)}
                      disabled={busy}
                      aria-busy={busy}
                      className="btn btn--secondary btn--s shrink-0"
                    >
                      <RefreshIcon className={`h-5 w-5${busy ? " animate-spin motion-reduce:animate-none" : ""}`} />
                      {busy ? "Bandoma…" : "Bandyti dar kartą"}
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>

          <footer className="flex flex-wrap justify-end gap-2">
            {status === "failed" ? (
              <button type="button" onClick={onReload} className="btn btn--secondary btn--s">
                <RefreshIcon className="h-5 w-5" />
                Gauti likusius duomenis
              </button>
            ) : null}
            <button type="button" onClick={() => setDismissed(true)} className="btn btn--s">
              {loading ? "Rodyti, kas jau gauta" : "Rodyti ataskaitą"}
            </button>
          </footer>
        </div>
      </dialog>

      {/* The window closed: one line keeps the state in view and opens it again. */}
      {dismissed ? (
        <p className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-card bg-paper-2 px-4 py-2 text-sm text-ink-2">
          <span className="flex items-center gap-2">
            {loading ? (
              <StepMark state="loading" />
            ) : (
              <WarningIcon className="h-5 w-5 shrink-0 text-warn" />
            )}
            {loading
              ? `Gauta ${answered} iš ${total}`
              : `Nepavyko gauti ${ltCount(failures.length, ["šaltinio", "šaltinių", "šaltinių"])}`}
          </span>
          <button type="button" onClick={() => setDismissed(false)} className="link min-h-11">
            {loading ? "Rodyti eigą" : "Peržiūrėti"}
          </button>
        </p>
      ) : null}
    </>
  );
}
