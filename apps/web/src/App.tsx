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
import { DetailSplit, ExploreClose, ReportShowcase, SourcesSpec } from "./components/HomeSections";
import {
  ChevronLeft,
  ChevronRight,
  DownloadIcon,
  PinIcon,
  RefreshIcon,
  SearchIcon,
  ShareIcon,
  Spinner,
  WarningIcon,
} from "./components/icons";
import { orpcClient, getParcelReport, generateParcelPdf } from "./lib/orpc";
import { useLocalStorage } from "./lib/useLocalStorage";
import { parcelKml, parcelPolygons } from "./lib/geo";

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
      {/* Stage: the head, its line and the search on five columns; the parcel
          on the orthophoto, edged in tangerine, on seven. Results open under
          the field, inside the same column. */}
      <section className="container">
        <div className="grid min-h-[calc(100svh-var(--nav-clear))] items-center gap-x-16 gap-y-10 py-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div className="grid gap-8">
            <div className="grid gap-5">
              <h1 className="max-w-[13ch] text-[clamp(2.5rem,4.4vw,4.25rem)]">Sužinokite viską apie žemės sklypą</h1>
              <p className="lead text-ink-2">
                Ribos, plotas, paskirtis, pastatai ir galimi apribojimai iš viešų Lietuvos registrų.
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
                <button type="submit" disabled={loading} aria-busy={loading} className="btn min-h-14">
                  {loading ? <Spinner className="h-5 w-5 animate-spin rounded-full border-2 border-ink/30 border-t-ink" /> : <SearchIcon className="h-5 w-5" />}
                  {loading ? "Ieškoma…" : "Ieškoti"}
                </button>
              </form>
              <p id="search-hint" className="text-sm text-ink-2">
                Pavyzdžiui <span className="code whitespace-nowrap text-ink">4400/0001:0007</span> arba{" "}
                <span className="code whitespace-nowrap text-ink">4400-4756-6034</span>
              </p>
            </div>

            {searchNote ? (
              <p role="status" className="flex gap-3 rounded-card bg-accent-soft px-5 py-4 text-md text-ink">
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

          {/* The parcel on the orthophoto, its notebook card pinned over the
              lower-left corner as on the report page. The card steps aside on
              narrow screens, where it would shrink past reading. */}
          <figure className="relative m-0 lg:mb-10">
            <div
              className="frame aspect-[1536/1366] shadow-card"
              data-slot="hero-parcel"
              data-kind="product"
              data-alt="Sklypas Vilniuje, Tilto g. 2A, apvestas oranžine linija ant ortofoto nuotraukos."
            >
              <img
                src="/screens/hero-ortho.jpg"
                width={1536}
                height={1366}
                alt="Sklypas Vilniuje, Tilto g. 2A, apvestas oranžine linija ant ortofoto nuotraukos."
                fetchPriority="high"
              />
            </div>
            <div
              className="absolute -bottom-10 -left-10 hidden w-[44%] overflow-hidden rounded-entry shadow-lift lg:block"
              data-slot="hero-card"
              data-kind="product"
              data-alt="Sklypo kortelė: kadastrinis numeris 0101/0041:0102, plotas 0,181 ha, paskirtis Kita."
              style={{ aspectRatio: "1024 / 660" }}
            >
              <img
                src="/screens/hero-card.jpg"
                width={1024}
                height={660}
                alt="Sklypo kortelė: kadastrinis numeris 0101/0041:0102, plotas 0,181 ha, paskirtis Kita, keturi pastatai."
              />
            </div>
          </figure>
        </div>
      </section>

      {history.length > 0 ? (
        <section className="border-y border-rule bg-paper-2 py-(--space-2xl)">
          <div className="container">
            <div className="max-w-[48rem]">
              <RecentlyViewed history={history} />
            </div>
          </div>
        </section>
      ) : null}

      <ReportShowcase />
      <DetailSplit />
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
  const [shareNote, setShareNote] = useState<string | null>(null);
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

  // Parcel outline as KML for Google Earth / QGIS, built in the browser from
  // the geometry the report already carries.
  function onDownloadKml() {
    if (!report) return;
    const polygons = parcelPolygons(report);
    if (polygons.length === 0) return;
    const name = `Sklypas ${report.cadastralRegNo}`;
    const blob = new Blob([parcelKml(name, polygons)], { type: "application/vnd.google-earth.kml+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sklypas-${report.cadastralRegNo.replace(/[^\w-]+/g, "_")}.kml`;
    link.click();
    URL.revokeObjectURL(url);
  }

  // The phone's own share sheet where there is one; elsewhere copy the link.
  async function onShare() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: `Sklypas ${cadastralRegNo}`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareNote("Nuoroda nukopijuota");
      setTimeout(() => setShareNote(null), 2500);
    } catch {
      // Share sheet dismissed or clipboard blocked: nothing to report.
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

  // The exact time the sources were read, so "Atnaujinti" beside it reads as
  // "read them again now" rather than a mystery.
  const freshness = report ? `Duomenys atnaujinti ${formatFetchedAt(report.fetchedAt)}` : "";

  const refreshButton = (
    <button
      type="button"
      onClick={onRefresh}
      disabled={loading}
      aria-busy={loading}
      className="btn btn--secondary btn--s flex-1 basis-32"
    >
      <RefreshIcon className="h-5 w-5" />
      {loading ? "Atnaujinama…" : "Atnaujinti"}
    </button>
  );

  return (
    <main id="main" className="container pt-4 pb-24 lg:pb-8">
      {/* The workbench: on desktop the map is one screen tall and stays put
          beside the report, which scrolls with the page. On a phone the map
          runs edge to edge first and the report follows. */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_30rem] lg:items-start lg:gap-8 xl:grid-cols-[minmax(0,1fr)_32rem]">
        <div className="-mt-4 md:mt-0 lg:sticky lg:top-[calc(var(--nav-clear)+1rem)] lg:h-[calc(100dvh-var(--nav-clear)-2rem)]">
          {report ? (
            <ParcelMap report={report} />
          ) : loading ? (
            <div
              className="-mx-(--gutter) h-[52svh] min-h-80 animate-pulse border-y border-rule bg-paper-2 md:mx-0 md:rounded-card md:border lg:h-full"
              aria-hidden="true"
            />
          ) : null}
        </div>

        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-8">
          <Link to="/" className="link inline-flex w-fit items-center gap-2 py-1 text-md no-underline hover:underline">
            <ChevronLeft className="h-5 w-5" />
            Atgal į paiešką
          </Link>

          {!report && loading ? (
            <div className="card flex items-center gap-4 p-6">
              <Spinner className="h-8 w-8 shrink-0 animate-spin rounded-full border-4 border-paper-2 border-t-ink" />
              <p className="text-md text-ink-2">Renkame sklypo duomenis…</p>
            </div>
          ) : null}

          {!report && !loading && loadFailed ? (
            <div className="grid gap-4 rounded-card bg-accent-soft p-6">
              <p className="flex gap-3 text-md text-ink">
                <WarningIcon className="mt-1 h-5 w-5 shrink-0 text-ink" />
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
                    <button
                      type="button"
                      onClick={onDownloadPdf}
                      disabled={pdfLoading}
                      aria-busy={pdfLoading}
                      className="btn w-full"
                    >
                      <DownloadIcon className="h-5 w-5" />
                      {pdfLoading ? "Generuojama…" : "Atsisiųsti PDF"}
                    </button>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={onShare} className="btn btn--secondary btn--s flex-1 basis-32">
                        <ShareIcon className="h-5 w-5" />
                        <span aria-live="polite">{shareNote ?? "Dalintis"}</span>
                      </button>
                      {parcelPolygons(report).length > 0 ? (
                        <button type="button" onClick={onDownloadKml} className="btn btn--secondary btn--s flex-1 basis-32">
                          <PinIcon className="h-5 w-5" />
                          Ribos (KML)
                        </button>
                      ) : null}
                      {refreshButton}
                    </div>
                    <p className="text-sm text-muted">{freshness}</p>
                  </div>
                }
                onRetry={onRefresh}
                retrying={loading}
              />

              <section className="grid grid-cols-[minmax(0,1fr)] gap-4">
                <h2 className="text-xl tracking-[-0.02em]">Detali informacija</h2>
                <ReportPanel report={report} onRetry={onRefresh} retrying={loading} />
              </section>
            </>
          ) : null}

          {/* The parcel on screen is not "recent": it is left out of its own list. */}
          <RecentlyViewed history={history.filter((entry) => entry.id !== cadastralRegNo)} />
        </div>
      </div>
    </main>
  );
}

// "šiandien 14:52", "vakar 09:10", or "2026-10-20 14:52".
function formatFetchedAt(iso: string): string {
  const at = new Date(iso);
  const time = at.toLocaleTimeString("lt-LT", { hour: "2-digit", minute: "2-digit" });
  const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const daysAgo = Math.round((dayStart(new Date()) - dayStart(at)) / 86_400_000);
  if (daysAgo === 0) return `šiandien ${time}`;
  if (daysAgo === 1) return `vakar ${time}`;
  return `${at.toLocaleDateString("lt-LT")} ${time}`;
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
