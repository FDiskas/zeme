import { useEffect, useMemo, useState } from "react";
import { Link, Route, Routes, useLocation, useParams } from "react-router-dom";
import type { ParcelReport } from "@zeme/shared";
import { ParcelMap } from "./components/ParcelMap";
import { ReportPanel } from "./components/ReportPanel";
import { SummaryCard } from "./components/SummaryCard";
import { AboutPage } from "./components/AboutPage";
import { DataSourcesPage } from "./components/DataSourcesPage";
import { TermsPage } from "./components/TermsPage";
import { MapExplorePage } from "./components/MapExplorePage";
import { ParcelAtPointPage } from "./components/ParcelAtPointPage";
import { Footer, Header, SaleNotice } from "./components/SiteChrome";
import { RecentlyViewed } from "./components/RecentlyViewed";
import { ParcelSearch } from "./components/ParcelSearch";
import { ExploreClose, ReportTour, SourcesSpec } from "./components/HomeSections";
import {
  ChevronLeft,
  DownloadIcon,
  InfoIcon,
  PinIcon,
  RefreshIcon,
  ShareIcon,
  Spinner,
  WarningIcon,
} from "./components/icons";
import { getParcelReport, generateParcelPdf } from "./lib/orpc";
import { parcelKml, parcelPolygons } from "./lib/geo";
import { useRecentParcels } from "./lib/useRecentParcels";

function HomePage() {
  return (
    <main id="main">
      {/* Banner: one centred corridor (the head, its line, the search), only
          as tall as its content; recent parcels open under the field. The
          parcel on the orthophoto follows at once, so it starts above the
          fold and the fold cuts through it: the reader sees that the page
          goes on. */}
      <section className="container pt-(--space-2xl) max-md:pt-(--space-xl)">
        <div className="mx-auto grid max-w-[46rem] grid-cols-[minmax(0,1fr)] gap-8">
          <div className="grid justify-items-center gap-5 text-center">
            <h1 className="max-w-[16ch]">Sužinokite viską apie žemės sklypą</h1>
            <p className="lead text-balance text-ink-2">
              Ribos, plotas, paskirtis, pastatai ir galimi apribojimai iš viešų Lietuvos registrų.
            </p>
          </div>

          <ParcelSearch />
        </div>
      </section>

      <section className="container pt-(--space-2xl)" aria-label="Pavyzdys: sklypas ant ortofoto">
        {/* The parcel on the orthophoto, its notebook card pinned over the
            lower-left corner as on the report page. The card steps aside on
            narrow screens, where it would shrink past reading. */}
        <figure className="relative m-0 grid grid-cols-[minmax(0,1fr)] lg:mb-(--space-xl) lg:grid-cols-12 lg:gap-x-(--gap-columns)">
          <div className="relative lg:col-span-10 lg:col-start-2">
            <div
              className="frame aspect-4/3 shadow-card md:aspect-2/1"
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
                style={{ objectPosition: "50% 52%" }}
              />
            </div>
            <div
              className="absolute -bottom-(--space-xl) -left-(--space-xl) hidden w-[34%] overflow-hidden rounded-entry shadow-lift lg:block"
              data-slot="hero-card"
              data-kind="product"
              data-alt="Sklypo kortelė: Tilto g. 2A, kadastrinis numeris 0101/0041:0102, plotas 0,181 ha, paskirtis Kita (KT)."
              style={{ aspectRatio: "1024 / 652" }}
            >
              <img
                src="/screens/hero-card.jpg"
                width={1024}
                height={652}
                alt="Sklypo kortelė: Tilto g. 2A, kadastrinis numeris 0101/0041:0102, pažymėta kultūros paveldas, plotas 0,181 ha, paskirtis Kita (KT)."
              />
            </div>
          </div>
        </figure>
      </section>

      <ReportTour />
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
  const recent = useRecentParcels();

  // The server rebuilds a parcel's report at most once per cooldown and says
  // when the next rebuild is allowed; until then the refresh keys give way to
  // that time. A timer brings them back once it has passed.
  const refreshAt = report?.refreshAvailableAt ? Date.parse(report.refreshAvailableAt) : 0;
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const timer = setTimeout(() => setClock(Date.now()), Math.max(0, refreshAt - Date.now()) + 500);
    return () => clearTimeout(timer);
  }, [refreshAt]);
  const canRefresh = refreshAt <= clock;
  const refreshTime = new Date(refreshAt).toLocaleTimeString("lt-LT", { hour: "2-digit", minute: "2-digit" });

  // Manual refresh — an event handler, so setting loading here is fine.
  async function onRefresh() {
    if (!cadastralRegNo || !canRefresh) return;
    setLoading(true);
    setLoadFailed(false);
    try {
      const data = await getParcelReport({ cadastralRegNo, forceRefresh: true });
      setReport(data);
      recent.remember(data);
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
        recent.remember(data);
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

  // The exact time the sources were read, so the ↻ key beside it reads as
  // "read them again now" rather than a mystery.
  const freshness = report ? `Duomenys atnaujinti ${formatFetchedAt(report.fetchedAt)}` : "";

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
            <div className="grid gap-4 rounded-card bg-warn-soft p-6">
              <p className="flex gap-3 text-md text-ink">
                <WarningIcon className="mt-1 h-5 w-5 shrink-0 text-ink" />
                Nepavyko gauti sklypo duomenų. Spauskite „Atnaujinti“ arba bandykite vėliau.
              </p>
              <div>
                <button type="button" onClick={onRefresh} disabled={loading} aria-busy={loading} className="btn btn--secondary btn--s">
                  <RefreshIcon className="h-5 w-5" />
                  {loading ? "Atnaujinama…" : "Atnaujinti"}
                </button>
              </div>
            </div>
          ) : null}

          {report ? (
            <>
              <SummaryCard
                report={report}
                actions={
                  <div className="grid gap-3">
                    {/* One row of three keys of one height: the primary leads
                        on its own line, the two helpers share the next. */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={onDownloadPdf}
                        disabled={pdfLoading}
                        aria-busy={pdfLoading}
                        className="btn btn--s col-span-2 text-md"
                      >
                        <DownloadIcon className="h-5 w-5" />
                        {pdfLoading ? "Generuojama…" : "Atsisiųsti PDF"}
                      </button>
                      <button
                        type="button"
                        onClick={onShare}
                        className={`btn btn--secondary btn--s${parcelPolygons(report).length > 0 ? "" : " col-span-2"}`}
                      >
                        <ShareIcon className="h-5 w-5" />
                        <span aria-live="polite">{shareNote ?? "Dalintis"}</span>
                      </button>
                      {parcelPolygons(report).length > 0 ? (
                        <button type="button" onClick={onDownloadKml} className="btn btn--secondary btn--s">
                          <PinIcon className="h-5 w-5" />
                          Ribos (KML)
                        </button>
                      ) : null}
                    </div>
                    {/* Refreshing is a helper, not a peer of sharing: a worded
                        link beside the time it would change, or, while the
                        sources rest, the time it comes back. */}
                    <p className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm text-muted">
                      <span>{loading ? "Atnaujinama…" : freshness}</span>
                      {canRefresh ? (
                        <button
                          type="button"
                          onClick={onRefresh}
                          disabled={loading}
                          aria-busy={loading}
                          className="link inline-flex min-h-11 items-center gap-1.5 disabled:text-muted"
                        >
                          <RefreshIcon className={`h-4 w-4 shrink-0${loading ? " animate-spin motion-reduce:animate-none" : ""}`} />
                          Atnaujinti
                        </button>
                      ) : (
                        <span>Vėl atnaujinti galėsite po {refreshTime}</span>
                      )}
                    </p>
                  </div>
                }
                onRetry={canRefresh ? onRefresh : undefined}
                retryAfter={canRefresh ? undefined : refreshTime}
                retrying={loading}
              />

              <section className="grid grid-cols-[minmax(0,1fr)] gap-4">
                <h2 className="text-xl tracking-[-0.02em]">Detali informacija</h2>
                <ReportPanel
                  report={report}
                  onRetry={canRefresh ? onRefresh : undefined}
                  retryAfter={canRefresh ? undefined : refreshTime}
                  retrying={loading}
                />
                <p className="flex gap-3 text-sm text-ink-2">
                  <InfoIcon className="mt-0.5 h-5 w-5 shrink-0 text-ink" />
                  <span>
                    Duomenys surinkti iš viešų registrų ir parodyti nekeičiant jų turinio. Tai nėra oficialus
                    dokumentas: prieš priimdami sprendimą, pasitikrinkite juos oficialiuose šaltiniuose.{" "}
                    <Link to="/naudojimosi-taisykles#neoficialu" className="link">
                      Kur pasitikrinti
                    </Link>
                  </span>
                </p>
              </section>
            </>
          ) : null}

          {/* The parcel on screen is not "recent": it is left out of its own list. */}
          <RecentlyViewed
            history={recent.history.filter((entry) => entry.id !== cadastralRegNo)}
            onRemove={recent.remove}
            onClear={recent.clear}
          />
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

// A new page opens at its top, or at the section its link names (#neoficialu),
// rather than at the scroll depth of the page the reader came from.
function ScrollOnNavigate() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    const target = hash ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;
    if (target) target.scrollIntoView();
    else window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

function App() {
  return (
    <div className="flex min-h-dvh flex-col">
      <ScrollOnNavigate />
      <SaleNotice />
      <Header />
      <div className="flex-1">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/zemelapis" element={<MapExplorePage />} />
          <Route path="/parcel/:cadastralRegNo" element={<ParcelPageRoute />} />
          <Route path="/vieta" element={<ParcelAtPointPage />} />
          <Route path="/duomenu-saltiniai" element={<DataSourcesPage />} />
          <Route path="/apie" element={<AboutPage />} />
          <Route path="/naudojimosi-taisykles" element={<TermsPage />} />
        </Routes>
      </div>
      <Footer />
    </div>
  );
}

export default App;
