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
    <section className="grid gap-4">
      <h2 className="text-title">Neseniai peržiūrėta</h2>

      {history.length === 0 ? (
        <p className="text-md text-muted">Peržiūrų istorijos dar nėra.</p>
      ) : (
        <ul className="spec">
          {history.map((item) => (
            <li key={`${item.id}-${item.timestamp}`} className="min-w-0">
              <Link
                to={`/parcel/${encodeURIComponent(item.id)}`}
                className="flex items-center justify-between gap-4 py-3 pr-2 transition-colors duration-150 hover:bg-accent-soft focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus active:bg-paper-3"
              >
                <div className="min-w-0">
                  <p className="wrap-break-word text-md font-medium text-ink">
                    {item.address && item.address.trim() !== "" ? item.address : "Žemės sklypas be adreso"}
                  </p>
                  <p className="wrap-break-word text-sm text-muted">
                    {item.locality ? `${item.locality}, ` : null}
                    <span className="code">{item.id}</span>
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-ink" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
