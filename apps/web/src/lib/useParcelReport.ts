import { useCallback, useEffect, useRef, useState } from "react";
import { REPORT_PANEL_KEYS, type ParcelReport, type ReportEvent, type ReportPanelKey } from "@zeme/shared";
import { retryReportPanel, streamParcelReport } from "./orpc";

export type ReportStatus = "loading" | "done" | "failed";

// What a report page needs to ask failed sources again, one by one.
export type PanelRetry = {
  onRetry: (key: ReportPanelKey) => void;
  retrying: ReadonlySet<string>;
};

type ReportPanel = ParcelReport["reportPanels"][number];

const PANEL_ORDER = new Map<string, number>(REPORT_PANEL_KEYS.map((key, index) => [key, index]));

// Adds a panel that has just arrived, keeping the report's order.
function withPanel(report: ParcelReport, panel: ReportPanel): ParcelReport {
  const panels = [...report.reportPanels.filter((p) => p.key !== panel.key), panel];
  panels.sort((a, b) => (PANEL_ORDER.get(a.key) ?? 99) - (PANEL_ORDER.get(b.key) ?? 99));
  return { ...report, reportPanels: panels };
}

// The panels still on their way while a report is built.
export function pendingPanels(report: ParcelReport | null, status: ReportStatus): ReadonlySet<string> {
  if (status !== "loading" || !report) return new Set();
  const arrived = new Set(report.reportPanels.map((p) => p.key));
  return new Set(REPORT_PANEL_KEYS.filter((key) => !arrived.has(key)));
}

// Reads a report stream to its end, handing each event on.
async function followReport(
  input: { cadastralRegNo: string; forceRefresh: boolean },
  signal: AbortSignal,
  onEvent: (event: ReportEvent) => void,
): Promise<ReportStatus | "aborted"> {
  try {
    for await (const event of streamParcelReport(input, signal)) onEvent(event);
    return "done";
  } catch {
    return signal.aborted ? "aborted" : "failed";
  }
}

/**
 * A parcel's report, loaded on mount. A cached report arrives whole; a new one
 * fills in as its sources answer (`rebuilt` then turns true), so the page can
 * draw the parcel early and show which sources are still out.
 */
export function useParcelReport(cadastralRegNo: string, onLoaded: (report: ParcelReport) => void) {
  const [report, setReport] = useState<ParcelReport | null>(null);
  // Starts "loading": the page always loads a report on mount, so the effect
  // never has to set it synchronously (which would trigger cascading renders).
  const [status, setStatus] = useState<ReportStatus>("loading");
  const [rebuilt, setRebuilt] = useState(false);
  // Counts loads, so views of one load's progress can start afresh on the next.
  const [run, setRun] = useState(0);
  const [retrying, setRetrying] = useState<ReadonlySet<string>>(new Set());
  const loadRef = useRef<AbortController | null>(null);
  const onLoadedRef = useRef(onLoaded);
  useEffect(() => {
    onLoadedRef.current = onLoaded;
  });

  const applyEvent = useCallback((event: ReportEvent) => {
    if (event.type === "parcel") {
      setRebuilt(true);
      setReport(event.report);
    } else if (event.type === "panel") {
      setReport((current) => (current ? withPanel(current, event.panel) : current));
    } else {
      setReport(event.report);
      onLoadedRef.current(event.report);
    }
  }, []);

  const follow = useCallback(
    (forceRefresh: boolean, controller: AbortController) => {
      void followReport({ cadastralRegNo, forceRefresh }, controller.signal, applyEvent).then((outcome) => {
        if (outcome !== "aborted") setStatus(outcome);
      });
    },
    [cadastralRegNo, applyEvent],
  );

  // Loads again on request (an event handler, so setting state here is fine).
  // A forced refresh rebuilds from the sources, within the server's cooldown.
  const reload = useCallback(
    (forceRefresh: boolean) => {
      loadRef.current?.abort();
      const controller = new AbortController();
      loadRef.current = controller;
      setStatus("loading");
      setRebuilt(false);
      setRun((n) => n + 1);
      follow(forceRefresh, controller);
    },
    [follow],
  );

  useEffect(() => {
    const controller = new AbortController();
    loadRef.current = controller;
    follow(false, controller);
    return () => controller.abort();
  }, [follow]);

  const retryPanel = useCallback(
    async (key: ReportPanelKey) => {
      setRetrying((keys) => new Set(keys).add(key));
      try {
        const updated = await retryReportPanel(cadastralRegNo, key);
        const retried = updated.reportPanels.find((panel) => panel.key === key);
        // Only this source is taken from the answer: retries run side by side,
        // and one that answers late must not undo another's panel.
        setReport((current) =>
          current && retried ? { ...updated, reportPanels: withPanel(current, retried).reportPanels } : updated,
        );
      } catch {
        // The panel stays failed and its key stays offered.
      } finally {
        setRetrying((keys) => {
          const next = new Set(keys);
          next.delete(key);
          return next;
        });
      }
    },
    [cadastralRegNo],
  );

  const retry: PanelRetry = { onRetry: retryPanel, retrying };
  return { report, status, rebuilt, run, reload, retry };
}
