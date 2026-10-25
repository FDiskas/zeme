import { Link } from "react-router-dom";
import { ChevronRight } from "./icons";

export type SearchHistoryItem = {
  id: string;
  address: string;
  locality?: string; // only for parcels without a street address
  timestamp: number;
};

type Props = {
  history: SearchHistoryItem[];
  /** Show a friendly placeholder instead of hiding when there's no history. */
  showEmptyState?: boolean;
};

/**
 * "Neseniai peržiūrėta" — the recently-viewed parcels list.
 *
 * Shared by the home page and the parcel page so both stay identical and a
 * styling change happens once.
 */
export function RecentlyViewed({ history, showEmptyState = false }: Props) {
  if (history.length === 0 && !showEmptyState) return null;

  return (
    <section className="grid gap-2">
      <h2 className="font-display text-xl font-bold tracking-tight text-mist-900">Neseniai peržiūrėta</h2>

      {history.length === 0 ? (
        <p className="text-lg text-mist-600">Peržiūrų istorijos dar nėra.</p>
      ) : (
        <ul className="divide-y divide-mist-200 overflow-hidden rounded-2xl border border-mist-200 bg-white">
          {history.map((item) => (
            <li key={`${item.id}-${item.timestamp}`} className="min-w-0">
              <Link
                to={`/parcel/${encodeURIComponent(item.id)}`}
                className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-mist-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-forest-600 active:bg-mist-100"
              >
                <div className="min-w-0">
                  <p className="wrap-break-word text-lg font-semibold text-mist-900">
                    {item.address && item.address.trim() !== "" ? item.address : "Žemės sklypas be adreso"}
                  </p>
                  <p className="wrap-break-word text-base text-mist-600 tabular-nums">
                    {item.locality ? `${item.locality}, ${item.id}` : item.id}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-mist-500" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
