import { useEffect, useMemo, useState } from "react";
import { Link, Route, Routes, useNavigate, useParams } from "react-router-dom";
import type { ParcelReport, ParcelSearchItem } from "@zeme/shared";
import { ParcelMap } from "./components/ParcelMap";
import { ReportPanel } from "./components/ReportPanel";
import { SummaryCard } from "./components/SummaryCard";
import { DataSourcesPage } from "./components/DataSourcesPage";
import { MapExplorePage } from "./components/MapExplorePage";
import { ParcelAtPointPage } from "./components/ParcelAtPointPage";
import { Footer, Header } from "./components/SiteChrome";
import { RecentlyViewed, type SearchHistoryItem } from "./components/RecentlyViewed";
import { ExploreClose, ReportStack, SourcesSpec } from "./components/HomeSections";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  DownloadIcon,
  RefreshIcon,
  SearchIcon,
  Spinner,
  WarningIcon,
} from "./components/icons";
import { orpcClient, getParcelReport, generateParcelPdf } from "./lib/orpc";
import { useLocalStorage } from "./lib/useLocalStorage";

const HISTORY_KEY = "zeme-search-history";

function HomePage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ParcelSearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchNote, setSearchNote] = useState<string | null>(null);

  const [history] = useLocalStorage<SearchHistoryItem[]>(HISTORY_KEY, []);

  async function onSearch() {
    if (query.trim().length < 2) return;
    setLoading(true);
    setSearchNote(null);
    try {
      const data = await orpcClient.parcel.autocomplete({ query: query.trim() });
      setResults(data);
      if (data.length === 0) {
        setSearchNote(
          "Nieko neradome. Įveskite kadastrinį numerį (pvz. 4400/0001:0007) arba unikalų daikto numerį (pvz. 4400-4756-6034).",
        );
      }
    } catch {
      setResults([]);
      setSearchNote("Paieška laikinai neveikia. Pabandykite vėliau.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main id="main">
      {/* Corridor: one centred column, the head set large, the search as the
          action. Results open under the field, inside the same column. */}
      <section className="container">
        <div className="flex min-h-[calc(100svh-var(--nav-clear)-6rem)] flex-col border-b-2 border-ink pt-16 pb-8">
          <div className="mx-auto my-auto grid w-full max-w-[64rem] gap-12">
            <div className="grid gap-6">
              <h1 className="max-w-[14ch] text-[clamp(2.75rem,7vw,6.3rem)] leading-[1.02]">Sužinokite viską apie žemės sklypą</h1>
              <p className="lead text-ink-2">
                Vieša Lietuvos žemės ir pastatų informacija: ribos žemėlapyje, plotas,
                paskirtis, pastatai ir galimi apribojimai.
              </p>
            </div>

            <div className="grid gap-3">
              <label htmlFor="parcel-search" className="text-md font-medium text-ink">
                Adresas, kadastrinis arba unikalus numeris
              </label>
              <form
                role="search"
                onSubmit={(event) => {
                  event.preventDefault();
                  onSearch();
                }}
                className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"
              >
                <div className="relative">
                  <SearchIcon className="pointer-events-none absolute top-1/2 left-4 h-6 w-6 -translate-y-1/2 text-muted" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    id="parcel-search"
                    aria-describedby="search-hint"
                    enterKeyHint="search"
                    autoComplete="off"
                    className="field pl-13"
                  />
                </div>
                <button type="submit" disabled={loading} aria-busy={loading} className="btn">
                  {loading ? <Spinner className="h-5 w-5 animate-spin rounded-full border-2 border-paper/40 border-t-paper" /> : <SearchIcon className="h-5 w-5" />}
                  {loading ? "Ieškoma…" : "Ieškoti"}
                </button>
              </form>
              <p id="search-hint" className="text-md text-ink-2">
                Pavyzdžiui <span className="code whitespace-nowrap text-accent">4400/0001:0007</span> arba{" "}
                <span className="code whitespace-nowrap text-accent">4400-4756-6034</span>
              </p>
            </div>

            {searchNote ? (
              <p role="status" className="flex gap-3 border-l-2 border-accent bg-accent-soft px-5 py-4 text-md text-ink">
                <WarningIcon className="mt-1 h-5 w-5 shrink-0 text-accent" />
                {searchNote}
              </p>
            ) : null}

            {results.length > 0 ? (
              <ul className="spec bg-plate">
                {results.map((result) => (
                  <li key={result.cadastralRegNo}>
                    <button
                      type="button"
                      onClick={() => navigate(`/parcel/${encodeURIComponent(result.cadastralRegNo)}`)}
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors duration-150 hover:bg-accent-soft focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus active:bg-paper-3"
                    >
                      <span className="min-w-0">
                        <span className="block text-lg font-medium text-ink">
                          {result.address && result.address.trim() !== ""
                            ? result.address
                            : "Adreso viešuose šaltiniuose nėra"}
                        </span>
                        <span className="code block text-sm text-accent">{result.cadastralRegNo}</span>
                      </span>
                      <ChevronRight className="h-6 w-6 shrink-0 text-ink" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {/* The hero fills the screen, so say out loud that the page goes on. */}
          <a
            href="#ataskaita"
            className="btn btn--secondary btn--s mx-auto mt-12"
          >
            Kaip atrodo ataskaita
            <ChevronDown className="h-5 w-5" />
          </a>
        </div>
      </section>

      {history.length > 0 ? (
        <section className="container pt-(--section-gap-s)">
          <div className="mx-auto max-w-[64rem]">
            <RecentlyViewed history={history} />
          </div>
        </section>
      ) : null}

      <ReportStack />
      <SourcesSpec />
      <ExploreClose />
    </main>
  );
}

function ParcelPage() {
  const params = useParams();
  const cadastralRegNo = useMemo(
    () => decodeURIComponent(params.cadastralRegNo ?? ""),
    [params.cadastralRegNo],
  );

  const [report, setReport] = useState<ParcelReport | null>(null);
  // Starts true: the page always loads a report on mount, so the effect never
  // has to set loading synchronously (which would trigger cascading renders).
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [history, setHistory] = useLocalStorage<SearchHistoryItem[]>(HISTORY_KEY, []);

  function rememberLookup(data: ParcelReport) {
    setHistory((prev) => {
      const next = [
        { id: data.cadastralRegNo, address: data.address, locality: data.locality, timestamp: Date.now() },
        ...prev.filter((entry) => entry.id !== data.cadastralRegNo),
      ];
      return next.slice(0, 10);
    });
  }

  // Manual refresh — an event handler, so setting loading here is fine.
  async function onRefresh() {
    if (!cadastralRegNo) return;
    setLoading(true);
    setLoadFailed(false);
    try {
      const data = await getParcelReport({ cadastralRegNo, forceRefresh: true });
      setReport(data);
      rememberLookup(data);
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }

  async function onDownloadPdf() {
    if (!cadastralRegNo || pdfLoading) return;
    setPdfLoading(true);
    try {
      const { pdfUrl } = await generateParcelPdf(cadastralRegNo);
      window.open(pdfUrl, "_blank", "noreferrer");
    } finally {
      setPdfLoading(false);
    }
  }

  // Auto-load on mount / when the cadastral number changes. The `ignore` flag
  // drops a stale response if the user navigates to another parcel mid-request.
  useEffect(() => {
    if (!cadastralRegNo) return;
    let ignore = false;
    window.scrollTo({ top: 0, behavior: "smooth" });

    (async () => {
      try {
        const data = await getParcelReport({ cadastralRegNo, forceRefresh: false });
        if (ignore) return;
        setReport(data);
        rememberLookup(data);
      } catch {
        if (!ignore) setLoadFailed(true);
      } finally {
        if (!ignore) setLoading(false);
      }
    })();

    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cadastralRegNo]);

  const freshness = report
    ? report.cached
      ? report.cacheAgeDays
        ? `Duomenys atnaujinti prieš ${report.cacheAgeDays} d.`
        : "Duomenys atnaujinti šiandien"
      : "Duomenys ką tik atnaujinti"
    : "";

  const refreshButton = (
    <button
      type="button"
      onClick={onRefresh}
      disabled={loading}
      aria-busy={loading}
      className="btn btn--secondary btn--s max-sm:flex-1"
    >
      <RefreshIcon className="h-5 w-5" />
      {loading ? "Atnaujinama…" : "Atnaujinti"}
    </button>
  );

  return (
    <main id="main" className="container pb-24 lg:pb-6">
      {/* The workbench: on desktop both columns stick level under the header.
          The map is one screen tall, so it stays put; the report column sticks
          too, but once it is taller than the screen it scrolls with the page and
          slides behind the header. On a phone the map runs edge to edge first
          and the report follows. */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_27rem] lg:items-start xl:grid-cols-[minmax(0,1fr)_29rem]">
        <div className="lg:sticky lg:top-(--nav-clear) lg:h-[calc(100dvh-var(--nav-clear)-1.5rem)]">
          {report ? (
            <ParcelMap report={report} />
          ) : loading ? (
            <div
              className="-mx-(--gutter) h-[45svh] min-h-72 animate-pulse border-y-2 border-ink bg-paper-2 md:mx-0 md:border-2 lg:h-full"
              aria-hidden="true"
            />
          ) : null}
        </div>

        <div className="grid min-w-0 gap-10 lg:sticky lg:top-(--nav-clear)">
          <Link to="/" className="link inline-flex w-fit items-center gap-2 py-1 text-md no-underline hover:underline">
            <ChevronLeft className="h-5 w-5" />
            Atgal į paiešką
          </Link>

          {!report && loading ? (
            <div className="frame flex items-center gap-4 p-6">
              <Spinner className="h-8 w-8 shrink-0 animate-spin rounded-full border-4 border-paper-3 border-t-ink" />
              <p className="text-md text-ink-2">Renkame sklypo duomenis…</p>
            </div>
          ) : null}

          {!report && !loading && loadFailed ? (
            <div className="grid gap-4 border-l-2 border-accent bg-accent-soft p-6">
              <p className="flex gap-3 text-md text-ink">
                <WarningIcon className="mt-1 h-5 w-5 shrink-0 text-accent" />
                Nepavyko gauti sklypo duomenų. Spauskite „Atnaujinti“ arba bandykite vėliau.
              </p>
              <div>{refreshButton}</div>
            </div>
          ) : null}

          {report ? (
            <>
              <SummaryCard
                report={report}
                actions={
                  <div className="grid gap-3">
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={onDownloadPdf}
                        disabled={pdfLoading}
                        aria-busy={pdfLoading}
                        className="btn btn--s flex-1"
                      >
                        <DownloadIcon className="h-5 w-5" />
                        {pdfLoading ? "Generuojama…" : "Atsisiųsti PDF"}
                      </button>
                      {refreshButton}
                    </div>
                    <p className="text-sm text-muted">{freshness}</p>
                  </div>
                }
              />

              <section className="grid gap-6">
                <h2 className="text-2xl">Detali informacija</h2>
                <ReportPanel report={report} />
              </section>
            </>
          ) : null}

          <RecentlyViewed history={history} showEmptyState />
        </div>
      </div>
    </main>
  );
}

// Remount ParcelPage per cadastral number: navigating from "Neseniai peržiūrėta"
// then starts fresh (report cleared, loading shown) instead of leaving the old
// map on screen while the new one loads in the background.
function ParcelPageRoute() {
  const { cadastralRegNo } = useParams();
  return <ParcelPage key={cadastralRegNo} />;
}

function App() {
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <div className="flex-1">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/zemelapis" element={<MapExplorePage />} />
          <Route path="/parcel/:cadastralRegNo" element={<ParcelPageRoute />} />
          <Route path="/vieta" element={<ParcelAtPointPage />} />
          <Route path="/duomenu-saltiniai" element={<DataSourcesPage />} />
        </Routes>
      </div>
      <Footer />
    </div>
  );
}

export default App;
