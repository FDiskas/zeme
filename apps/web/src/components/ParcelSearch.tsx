import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { parseSearchQuery, SEARCH_KIND_LABELS, type ParcelSearchItem, type SearchQuery } from "@zeme/shared";
import { orpcClient } from "../lib/orpc";
import { shortAddress } from "../lib/report-format";
import { RECENT_LIMIT, useRecentParcels } from "../lib/useRecentParcels";
import { CheckIcon, ChevronRight, CloseIcon, InfoIcon, SearchIcon, Spinner, WarningIcon } from "./icons";

// One parcel, Tilto g. 2A in Vilnius, written every way the search reads. A
// kind with no example to type (a Maps link) says where to get one instead,
// so every key holds two lines.
const EXAMPLES: { kind: SearchQuery["kind"]; example?: string; hint?: string }[] = [
  { kind: "unique", example: "1010-0410-102" },
  { kind: "cadastral", example: "0101/0041:0102" },
  { kind: "address", example: "Tilto g. 2A, Vilnius" },
  { kind: "gps", example: "54.68632, 25.28576" },
  { kind: "lks", example: "582903, 6061858" },
  { kind: "maps-link", hint: "„Bendrinti“ → „Kopijuoti nuorodą“" },
];

// Why nothing came back, in the terms of what the reader typed.
function notFoundNote(query: SearchQuery): string {
  switch (query.kind) {
    case "unique":
    case "cadastral":
      return "Tokio numerio registruose neradome. Patikrinkite skaičius.";
    case "gps":
    case "lks":
    case "maps-link":
      return "Šioje vietoje sklypo neradome: tai gali būti kelias, vanduo ar neįregistruota žemė.";
    case "maps-short-link":
      return "Nepavyko atverti šios nuorodos. Google Maps paspauskite ant vietos ir nukopijuokite koordinates.";
    case "link":
      return "Skelbimų nuorodų kol kas neskaitome. Skelbime raskite sklypo unikalų arba kadastro numerį ir įklijuokite jį čia.";
    case "address":
      return "Adreso neradome. Pabandykite užrašyti kitaip arba įveskite unikalų numerį (pvz. 1010-0410-102).";
  }
}

/**
 * The home page search: one field that reads numbers, addresses, coordinates
 * and Google Maps links. It names the kind it recognised as the reader types,
 * opens a parcel directly when the entry pins exactly one, and lists the
 * matches of an address. While the field is empty and focused, a menu under
 * it holds the parcels opened lately and what can be typed.
 */
export function ParcelSearch() {
  const navigate = useNavigate();
  const recent = useRecentParcels();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ParcelSearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchNote, setSearchNote] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const recognised = query.trim().length >= 2 ? parseSearchQuery(query) : null;

  async function search(text: string) {
    const trimmed = text.trim();
    if (trimmed.length < 2) return;
    const parsed = parseSearchQuery(trimmed);
    setMenuOpen(false);
    setResults([]);
    setSearchNote(null);
    if (parsed.kind === "link") {
      setSearchNote(notFoundNote(parsed));
      return;
    }

    setLoading(true);
    try {
      const data = await orpcClient.parcel.autocomplete({ query: trimmed });
      if (data.length === 1 && parsed.kind !== "address") {
        navigate(`/parcel/${encodeURIComponent(data[0]!.cadastralRegNo)}`);
        return;
      }
      setResults(data);
      if (data.length === 0) setSearchNote(notFoundNote(parsed));
    } catch {
      setSearchNote("Paieška laikinai neveikia. Pabandykite vėliau.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-3">
      <label htmlFor="parcel-search" className="text-md font-medium text-ink">
        Unikalus numeris, adresas ar koordinatės
      </label>

      {/* The menu opens under the field while it is empty and focused, and
          closes when focus leaves the whole search. */}
      <div
        className="relative"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setMenuOpen(false);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") setMenuOpen(false);
        }}
      >
        <form
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            search(query);
          }}
          className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"
        >
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-4 h-6 w-6 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setMenuOpen(event.target.value === "");
              }}
              onFocus={() => setMenuOpen(query === "")}
              id="parcel-search"
              aria-describedby="search-hint"
              aria-expanded={menuOpen}
              aria-controls="search-examples"
              enterKeyHint="search"
              autoComplete="off"
              spellCheck={false}
              className="field pr-14 pl-13"
            />
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label="Ką galima įvesti?"
              aria-expanded={menuOpen}
              aria-controls="search-examples"
              className="absolute top-1/2 right-1.5 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-pill text-muted transition-colors duration-150 hover:bg-paper-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-focus"
            >
              <InfoIcon className="h-5 w-5" />
            </button>
          </div>
          <button type="submit" disabled={loading} aria-busy={loading} className="btn min-h-14">
            {loading ? (
              <Spinner className="h-5 w-5 animate-spin rounded-full border-2 border-ink/30 border-t-ink" />
            ) : (
              <SearchIcon className="h-5 w-5" />
            )}
            {loading ? "Ieškoma…" : "Ieškoti"}
          </button>
        </form>

        {menuOpen ? (
          <div
            id="search-examples"
            // Keeps focus in the field, so a click on an example lands.
            onMouseDown={(event) => event.preventDefault()}
            className="card absolute inset-x-0 top-full z-30 mt-2 grid gap-3 p-4"
          >
            {recent.history.length > 0 ? (
              <div className="grid gap-1 border-b border-rule pb-3">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm font-medium text-muted">Neseniai peržiūrėta</p>
                  <button type="button" onClick={recent.clear} className="link min-h-11 text-sm">
                    Išvalyti
                  </button>
                </div>
                <ul className="grid">
                  {recent.history.slice(0, RECENT_LIMIT).map((item) => {
                    const address = item.address && item.address.trim() !== "" ? item.address : "Žemės sklypas be adreso";
                    const label = item.locality ? `${shortAddress(address)}, ${item.locality}` : shortAddress(address);
                    return (
                      <li key={item.id} className="flex min-w-0 items-center gap-1">
                        <Link
                          to={`/parcel/${encodeURIComponent(item.id)}`}
                          className="flex min-h-11 min-w-0 flex-1 items-baseline gap-x-3 rounded-pill px-3 py-2 no-underline transition-colors duration-150 hover:bg-paper focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus active:bg-paper-2"
                        >
                          <span title={address} className="min-w-0 flex-1 truncate text-md text-ink">
                            {label}
                          </span>
                          <span className="code hidden shrink-0 text-sm text-muted sm:inline">{item.id}</span>
                        </Link>
                        <button
                          type="button"
                          onClick={() => recent.remove(item.id)}
                          aria-label={`Pašalinti iš sąrašo: ${label}`}
                          className="grid h-11 w-11 shrink-0 place-items-center rounded-pill text-muted transition-colors duration-150 hover:bg-paper hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus active:bg-paper-2"
                        >
                          <CloseIcon className="h-4 w-4" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            <p className="text-sm font-medium text-muted">Ką galima įvesti</p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {EXAMPLES.map(({ kind, example, hint }) => {
                const body = (
                  <>
                    <span className="block text-sm font-medium text-ink">{SEARCH_KIND_LABELS[kind]}</span>
                    {example ? (
                      <span className="code block truncate text-sm text-ink-2">{example}</span>
                    ) : (
                      <span className="block truncate text-sm text-muted">{hint}</span>
                    )}
                  </>
                );
                return (
                  <li key={kind} className="min-w-0">
                    {!example ? (
                      <div className="rounded-pill bg-paper px-3 py-2">{body}</div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setQuery(example);
                          search(example);
                        }}
                        className="block w-full rounded-pill bg-paper px-3 py-2 text-left transition-colors duration-150 hover:bg-paper-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus active:bg-paper-3"
                      >
                        {body}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>

      <p id="search-hint" aria-live="polite" className="flex min-h-8 flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-2">
        {recognised && recognised.kind !== "link" ? (
          <span className="chip chip--clear">
            <CheckIcon className="h-4 w-4" />
            {SEARCH_KIND_LABELS[recognised.kind]}
          </span>
        ) : (
          <>
            Pavyzdžiui <span className="code whitespace-nowrap text-ink">1010-0410-102</span> arba{" "}
            <span className="code whitespace-nowrap text-ink">0101/0041:0102</span>
          </>
        )}
      </p>

      {searchNote ? (
        <p role="status" className="flex gap-3 rounded-card bg-warn-soft px-5 py-4 text-md text-ink">
          <WarningIcon className="mt-1 h-5 w-5 shrink-0 text-ink" />
          {searchNote}
        </p>
      ) : null}

      {results.length > 0 ? (
        <ul className="card divide-y divide-rule overflow-hidden">
          {results.map((result) => (
            <li key={result.cadastralRegNo}>
              <button
                type="button"
                onClick={() => navigate(`/parcel/${encodeURIComponent(result.cadastralRegNo)}`)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors duration-150 hover:bg-paper focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus active:bg-paper-2"
              >
                <span className="min-w-0">
                  <span className="block text-lg font-medium text-ink">
                    {result.address && result.address.trim() !== ""
                      ? result.address
                      : "Adreso viešuose šaltiniuose nėra"}
                  </span>
                  <span className="code block text-sm text-ink-2">{result.cadastralRegNo}</span>
                </span>
                <ChevronRight className="h-6 w-6 shrink-0 text-ink" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
