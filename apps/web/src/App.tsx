import { useEffect, useMemo, useState } from "react";
import { Link, Route, Routes, useNavigate, useParams } from "react-router-dom";
import type { ParcelReport, ParcelSearchItem } from "@zeme/shared";
import { ParcelMap } from "./components/ParcelMap";
import { ReportPanel } from "./components/ReportPanel";
import { SummaryCard } from "./components/SummaryCard";
import { Footer, Header } from "./components/SiteChrome";
import { RecentlyViewed, type SearchHistoryItem } from "./components/RecentlyViewed";
import {
  ChevronLeft,
  DownloadIcon,
  RefreshIcon,
  SearchIcon,
  Spinner,
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
    <main className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 md:px-8">
      <section className="relative animate-rise overflow-hidden rounded-3xl border border-mist-200 bg-white shadow-soft">
        {/* Survey-grid texture + emerald wash for a calm "maps" feel. */}
        <div className="survey-grid pointer-events-none absolute inset-0 opacity-70" aria-hidden="true" />
        <div
          className="pointer-events-none absolute inset-0 bg-linear-to-br from-forest-50/80 via-white/40 to-lime-50/60"
          aria-hidden="true"
        />
        <div className="relative p-6 md:p-12">
          <p className="inline-flex items-center gap-2 rounded-full border border-forest-200 bg-forest-50/80 px-3.5 py-1.5 text-base font-semibold text-forest-700">
            <span className="h-2 w-2 rounded-full bg-lime-500" aria-hidden="true" />
            Vieša Lietuvos žemės ir pastatų informacija
          </p>
          <h1 className="mt-5 max-w-3xl font-display text-4xl font-bold leading-[1.08] tracking-tight text-mist-900 md:text-6xl">
            Sužinokite viską apie{" "}
            <span className="text-forest-700">žemės sklypą</span>
          </h1>
          <p className="mt-5 max-w-2xl text-xl leading-relaxed text-mist-600">
            Įveskite adresą, kadastrinį arba unikalų daikto numerį ir gaukite aiškią
            sklypo apžvalgą: ribas žemėlapyje, plotą, paskirtį, pastatus ir galimus apribojimus.
          </p>

          <div className="mt-8 flex flex-col gap-3 md:flex-row">
            <div className="relative flex-1">
              <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-mist-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") onSearch();
                }}
                placeholder="Adresas, kadastrinis arba unikalus numeris"
                aria-label="Adresas, kadastrinis arba unikalus numeris"
                className="w-full rounded-2xl border border-mist-300 bg-white py-4 pl-13 pr-5 text-lg text-mist-900 shadow-sm outline-none transition placeholder:text-mist-400 focus-visible:border-forest-400 focus-visible:ring-4 focus-visible:ring-forest-500/20"
              />
            </div>
            <button
              type="button"
              onClick={onSearch}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-forest-700 px-7 py-4 text-lg font-semibold text-white shadow-soft transition hover:bg-forest-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
            >
              <SearchIcon className="h-5 w-5" />
              {loading ? "Ieškoma…" : "Ieškoti"}
            </button>
          </div>

          <div className="mt-6 grid gap-3">
            {searchNote ? (
              <p className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-lg text-amber-900">
                {searchNote}
              </p>
            ) : null}

            {results.map((result) => (
              <button
                key={result.cadastralRegNo}
                type="button"
                onClick={() => navigate(`/parcel/${encodeURIComponent(result.cadastralRegNo)}`)}
                className="rounded-2xl border border-mist-200 bg-white px-5 py-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-forest-300 hover:shadow-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600"
              >
                <p className="text-lg font-semibold text-mist-900">
                  {result.address && result.address.trim() !== ""
                    ? result.address
                    : "Adreso viešuose šaltiniuose nėra"}
                </p>
                <p className="text-base text-mist-500">{result.cadastralRegNo}</p>
              </button>
            ))}
          </div>
        </div>
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
  const [history, setHistory] = useLocalStorage<SearchHistoryItem[]>(HISTORY_KEY, []);

  function rememberLookup(data: ParcelReport) {
    setHistory((prev) => {
      const next = [
        { id: data.cadastralRegNo, address: data.address, timestamp: Date.now() },
        ...prev.filter((entry) => entry.id !== data.cadastralRegNo),
      ];
      return next.slice(0, 10);
    });
  }

  // Manual refresh — an event handler, so setting loading here is fine.
  async function onRefresh() {
    if (!cadastralRegNo) return;
    setLoading(true);
    try {
      const data = await getParcelReport({ cadastralRegNo, forceRefresh: true });
      setReport(data);
      rememberLookup(data);
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
      ? `Duomenys atnaujinti prieš ${report.cacheAgeDays ?? 0} d.`
      : "Duomenys ką tik atnaujinti"
    : "";

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-lg px-1 py-1 text-lg font-semibold text-forest-700 transition hover:text-forest-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600"
        >
          <ChevronLeft className="h-5 w-5" />
          Atgal į paiešką
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-2 rounded-xl border border-mist-300 bg-white px-5 py-3 text-lg font-semibold text-mist-900 transition hover:bg-mist-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600 active:scale-[0.98]"
          >
            <RefreshIcon className="h-5 w-5" />
            {loading ? "Atnaujinama…" : "Atnaujinti"}
          </button>
          {report ? (
            <button
              type="button"
              onClick={onDownloadPdf}
              disabled={pdfLoading}
              className="inline-flex items-center gap-2 rounded-xl bg-forest-700 px-5 py-3 text-lg font-semibold text-white shadow-soft transition hover:bg-forest-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
            >
              <DownloadIcon className="h-5 w-5" />
              {pdfLoading ? "Generuojama…" : "Atsisiųsti PDF"}
            </button>
          ) : null}
        </div>
      </div>

      {!report && loading ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-mist-200 bg-white p-12 text-center">
          <Spinner />
          <p className="text-xl text-mist-600">Renkame sklypo duomenis…</p>
        </div>
      ) : null}

      {report ? (
        <div className="grid animate-rise gap-6">
          <SummaryCard report={report} />
          <ParcelMap report={report} />
          <section className="grid gap-6">
            <h2 className="font-display text-2xl font-bold tracking-tight text-mist-900">
              Detali informacija
            </h2>
            <ReportPanel report={report} />
          </section>
          <p className="text-base text-mist-500">{freshness}</p>
        </div>
      ) : null}

      <RecentlyViewed history={history} showEmptyState />
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
          <Route path="/parcel/:cadastralRegNo" element={<ParcelPageRoute />} />
        </Routes>
      </div>
      <Footer />
    </div>
  );
}

export default App;
