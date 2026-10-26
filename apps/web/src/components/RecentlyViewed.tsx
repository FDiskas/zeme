import { Link } from "react-router-dom";
import { shortAddress } from "../lib/report-format";
import { RECENT_LIMIT, type SearchHistoryItem } from "../lib/useRecentParcels";
import { CloseIcon } from "./icons";

type Props = {
  history: SearchHistoryItem[];
  onRemove: (id: string) => void;
  onClear: () => void;
};

/**
 * "Neseniai peržiūrėta" — the last few parcels opened, one line each, with a
 * key to drop one and a link to clear them all.
 *
 * Shared by the home page and the parcel page so both stay identical and a
 * styling change happens once.
 */
export function RecentlyViewed({ history, onRemove, onClear }: Props) {
  if (history.length === 0) return null;

  return (
    <section className="grid gap-2" aria-labelledby="recent-heading">
      <div className="flex items-center justify-between gap-4">
        <h2 id="recent-heading" className="font-body text-sm font-medium tracking-normal text-muted">
          Neseniai peržiūrėta
        </h2>
        <button type="button" onClick={onClear} className="link min-h-11 text-sm">
          Išvalyti
        </button>
      </div>

      <ul className="spec">
        {history.slice(0, RECENT_LIMIT).map((item) => {
          const address = item.address && item.address.trim() !== "" ? item.address : "Žemės sklypas be adreso";
          const label = item.locality ? `${shortAddress(address)}, ${item.locality}` : shortAddress(address);
          return (
            <li key={item.id} className="flex min-w-0 items-center gap-1">
              <Link
                to={`/parcel/${encodeURIComponent(item.id)}`}
                className="-ml-2 flex min-h-11 min-w-0 flex-1 items-baseline gap-x-3 rounded-pill px-2 py-2 transition-colors duration-150 hover:bg-paper-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus active:bg-paper-3"
              >
                <span title={address} className="min-w-0 flex-1 truncate text-md text-ink">
                  {label}
                </span>
                <span className="code hidden shrink-0 text-sm text-muted sm:inline">{item.id}</span>
              </Link>
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                aria-label={`Pašalinti iš sąrašo: ${label}`}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-pill text-muted transition-colors duration-150 hover:bg-paper-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-focus"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
