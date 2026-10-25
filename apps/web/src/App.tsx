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
import {
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
    <main
      className={`mx-auto grid w-full max-w-shell gap-10 px-4 pt-10 pb-16 md:px-8 md:pt-20 lg:gap-16 ${
        history.length > 0 ? "lg:grid-cols-[minmax(0,1fr)_26rem]" : ""
      }`}
    >
      <section className={`grid w-full max-w-3xl content-start gap-6 ${history.length > 0 ? "" : "lg:mx-auto"}`}>
        <div className="grid gap-3">
          <h1 className="font-display text-4xl font-bold leading-[1.06] tracking-tight text-mist-900 md:text-6xl">
            Sužinokite viską apie žemės sklypą
          </h1>
          <p className="max-w-2xl text-xl leading-relaxed text-mist-700">
            Vieša Lietuvos žemės ir pastatų informacija: ribos žemėlapyje, plotas,
            paskirtis, pastatai ir galimi apribojimai.
          </p>
        </div>

        <form
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            onSearch();
          }}
          className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"
        >
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-mist-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Adresas, kadastrinis arba unikalus numeris"
              aria-label="Adresas, kadastrinis arba unikalus numeris"
              enterKeyHint="search"
              className="h-14 w-full rounded-xl border border-mist-500 bg-white pl-13 pr-4 text-lg text-mist-900 outline-none placeholder:text-mist-600 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-forest-600"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-14 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-forest-700 px-7 text-lg font-semibold text-white transition-colors hover:bg-forest-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-700 active:bg-forest-900 disabled:cursor-not-allowed disabled:opacity-55"
          >
            {loading ? <Spinner className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <SearchIcon className="h-5 w-5" />}
            {loading ? "Ieškoma…" : "Ieškoti"}
          </button>
        </form>

        {searchNote ? (
          <p role="status" className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-lg text-amber-900">
            <WarningIcon className="mt-1 h-5 w-5 shrink-0 text-amber-700" />
            {searchNote}
          </p>
        ) : null}

        {results.length > 0 ? (
          <ul className="divide-y divide-mist-200 overflow-hidden rounded-2xl border border-mist-200 bg-white">
            {results.map((result) => (
              <li key={result.cadastralRegNo}>
                <button
                  type="button"
                  onClick={() => navigate(`/parcel/${encodeURIComponent(result.cadastralRegNo)}`)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-mist-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-forest-600 active:bg-mist-100"
                >
                  <span className="min-w-0">
                    <span className="block text-lg font-semibold text-mist-900">
                      {result.address && result.address.trim() !== ""
                        ? result.address
                        : "Adreso viešuose šaltiniuose nėra"}
                    </span>
                    <span className="block text-base text-mist-600 tabular-nums">{result.cadastralRegNo}</span>
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-mist-500" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <RecentlyViewed history={history} />
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
      className="inline-flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-mist-500 bg-white px-4 max-sm:flex-1 text-lg font-semibold text-mist-900 transition-colors hover:bg-mist-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600 active:bg-mist-200 disabled:cursor-not-allowed disabled:opacity-55"
    >
      <RefreshIcon className="h-5 w-5" />
      {loading ? "Atnaujinama…" : "Atnaujinti"}
    </button>
  );

  return (
    <main className="mx-auto w-full max-w-shell px-4 pt-0 pb-10 md:px-8 md:pt-4 lg:py-4">
      {/* The workbench: on desktop the map fills the left of the screen and stays
          put while the report column scrolls beside it; on a phone the map runs
          edge to edge first and the report follows. */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_26rem] lg:items-start lg:gap-6 xl:grid-cols-[minmax(0,1fr)_28rem]">
        <div className="lg:sticky lg:top-20 lg:h-[calc(100dvh-6rem)]">
          {report ? (
            <ParcelMap report={report} />
          ) : loading ? (
            <div
              className="-mx-4 h-[45svh] min-h-72 animate-pulse border-y border-mist-200 bg-mist-100 md:mx-0 md:rounded-2xl md:border lg:h-full"
              aria-hidden="true"
            />
          ) : null}
        </div>

        <div className="grid gap-6">
          <Link
            to="/"
            className="inline-flex w-fit items-center gap-1.5 rounded-lg py-1 text-lg font-semibold text-forest-700 transition-colors hover:text-forest-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600"
          >
            <ChevronLeft className="h-5 w-5" />
            Atgal į paiešką
          </Link>

          {!report && loading ? (
            <div className="flex items-center gap-4 rounded-2xl border border-mist-200 bg-white p-5">
              <Spinner className="h-8 w-8 shrink-0 animate-spin rounded-full border-4 border-mist-200 border-t-forest-600" />
              <p className="text-lg text-mist-700">Renkame sklypo duomenis…</p>
            </div>
          ) : null}

          {!report && !loading && loadFailed ? (
            <div className="grid gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <p className="flex gap-3 text-lg text-amber-900">
                <WarningIcon className="mt-1 h-5 w-5 shrink-0 text-amber-700" />
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
                  <div className="grid gap-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={onDownloadPdf}
                        disabled={pdfLoading}
                        className="inline-flex h-12 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-forest-700 px-5 text-lg font-semibold text-white transition-colors hover:bg-forest-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-700 active:bg-forest-900 disabled:cursor-not-allowed disabled:opacity-55"
                      >
                        <DownloadIcon className="h-5 w-5" />
                        {pdfLoading ? "Generuojama…" : "Atsisiųsti PDF"}
                      </button>
                      {refreshButton}
                    </div>
                    <p className="text-base text-mist-600">{freshness}</p>
                  </div>
                }
              />

              <section className="grid gap-4">
                <h2 className="font-display text-2xl font-bold tracking-tight text-mist-900">
                  Detali informacija
                </h2>
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
    <div className="flex min-h-dvh flex-col text-mist-900">
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
