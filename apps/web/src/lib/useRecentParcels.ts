import type { ParcelReport } from "@zeme/shared";
import { useLocalStorage } from "./useLocalStorage";

export type SearchHistoryItem = {
  id: string;
  address: string;
  locality?: string; // only for parcels without a street address
  timestamp: number;
};

/** How many recent parcels are shown. */
export const RECENT_LIMIT = 5;
const HISTORY_KEY = "zeme-search-history";

/**
 * The recently opened parcels, newest first, kept across visits. One more
 * than is shown is kept, so the parcel page, which leaves out the parcel on
 * screen, still lists five.
 */
export function useRecentParcels() {
  const [history, setHistory] = useLocalStorage<SearchHistoryItem[]>(HISTORY_KEY, []);

  const remember = (report: ParcelReport) =>
    setHistory((prev) =>
      [
        { id: report.cadastralRegNo, address: report.address, locality: report.locality, timestamp: Date.now() },
        ...prev.filter((entry) => entry.id !== report.cadastralRegNo),
      ].slice(0, RECENT_LIMIT + 1),
    );
  const remove = (id: string) => setHistory((prev) => prev.filter((entry) => entry.id !== id));
  const clear = () => setHistory([]);

  return { history, remember, remove, clear };
}
