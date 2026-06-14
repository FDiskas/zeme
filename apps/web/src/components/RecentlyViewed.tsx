import { Link } from "react-router-dom";
import { ChevronRight, PinIcon } from "./icons";

export type SearchHistoryItem = {
  id: string;
  address: string;
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
 * Previously duplicated between the home page and the parcel page; kept here as
 * the single owner so both stay identical and a styling change happens once.
 */
export function RecentlyViewed({ history, showEmptyState = false }: Props) {
  if (history.length === 0 && !showEmptyState) return null;

  return (
    <section className="rounded-2xl border border-sand-200 bg-white p-6 shadow-sm md:p-7">
      <h2 className="flex items-center gap-2.5 font-serif text-2xl font-bold text-sand-900">
        <PinIcon className="h-6 w-6 text-clay-600" />
        Neseniai peržiūrėta
      </h2>

      {history.length === 0 ? (
        <p className="mt-4 text-lg text-sand-600">Peržiūrų istorijos dar nėra.</p>
      ) : (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {history.map((item) => (
            <li key={`${item.id}-${item.timestamp}`}>
              <Link
                to={`/parcel/${encodeURIComponent(item.id)}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-sand-200 bg-sand-50 p-4 transition hover:border-clay-300 hover:bg-clay-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-600"
              >
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold text-sand-900">{item.address}</p>
                  <p className="truncate text-base text-sand-500">{item.id}</p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-sand-400" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
