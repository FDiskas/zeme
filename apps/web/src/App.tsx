import { useEffect, useMemo, useState } from "react";
import { Link, Route, Routes, useNavigate, useParams } from "react-router-dom";
import type { ParcelReport, ParcelSearchItem } from "@zeme/shared";
import { ParcelMap } from "./components/ParcelMap";
import { ReportPanel } from "./components/ReportPanel";
import { SummaryCard } from "./components/SummaryCard";
import { orpcClient, getParcelReport } from "./lib/orpc";
import { useLocalStorage } from "./lib/useLocalStorage";

type SearchHistoryItem = {
  id: string;
  address: string;
  timestamp: number;
};

function PinIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
    </svg>
  );
}

function Spinner() {
  return (
    <span
      className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-teal-600 motion-reduce:animate-none"
      role="status"
      aria-label="Kraunama"
    />
  );
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.009-.868-.014-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-center md:flex-row md:px-8 md:text-left">
        <p className="text-base text-slate-600">
          Žemė.lt — sklypų informacija iš viešų Lietuvos registrų.
        </p>
        <a
          href="https://github.com/vkuciauskas/zeme"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-base font-semibold text-slate-800 transition hover:border-teal-300 hover:text-teal-700 active:scale-[0.98]"
        >
          <GitHubIcon className="h-5 w-5" />
          Projektas GitHub
        </a>
      </div>
    </footer>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-8">
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-teal-500/20">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.61c-.38.19-.622.58-.622 1.006v12.022c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
            </svg>
          </div>
          <span className="text-2xl font-extrabold tracking-tight text-slate-900">
            Žemė<span className="ml-1 text-sm font-semibold uppercase tracking-widest text-teal-600/80">.lt</span>
          </span>
        </Link>
        <nav className="flex items-center gap-6">
          <Link to="/" className="text-lg font-semibold text-slate-700 transition hover:text-teal-600">
            Pradžia
          </Link>
        </nav>
      </div>
    </header>
  );
}

function HomePage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ParcelSearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchNote, setSearchNote] = useState<string | null>(null);

  const [history] = useLocalStorage<SearchHistoryItem[]>("zeme-search-history", []);

  async function onSearch() {
    if (query.trim().length < 2) return;
    setLoading(true);
    setSearchNote(null);
    try {
      const data = await orpcClient.parcel.autocomplete({ query: query.trim() });
      setResults(data);
      if (data.length === 0) {
        setSearchNote(
          "Pagal adresą ieškoti šiuo metu negalime. Įveskite kadastrinį numerį, pavyzdžiui 4400/0001:0007.",
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
      <section className="rounded-3xl border border-slate-300 bg-gradient-to-br from-emerald-100 via-teal-50 to-cyan-50 p-6 shadow-sm md:p-10">
        <h1 className="text-3xl font-bold text-slate-900 md:text-5xl">
          Sužinokite viską apie žemės sklypą
        </h1>
        <p className="mt-4 max-w-3xl text-xl text-slate-700">
          Įveskite adresą arba kadastrinį numerį ir gaukite aiškią sklypo apžvalgą:
          ribas žemėlapyje, plotą, paskirtį, pastatus ir galimus apribojimus.
        </p>

        <div className="mt-7 flex flex-col gap-3 md:flex-row">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onSearch();
            }}
            placeholder="Adresas arba kadastrinis numeris"
            className="w-full rounded-xl border border-slate-300 bg-white px-5 py-4 text-lg text-slate-900 shadow-sm outline-none ring-teal-500 transition focus:ring-2"
          />
          <button
            type="button"
            onClick={onSearch}
            className="rounded-xl bg-teal-600 px-6 py-4 text-lg font-semibold text-white transition hover:bg-teal-500 active:scale-[0.98]"
          >
            {loading ? "Ieškoma…" : "Ieškoti"}
          </button>
        </div>

        <div className="mt-6 grid gap-3">
          {searchNote ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-lg text-amber-900">
              {searchNote}
            </p>
          ) : null}

          {results.map((result) => (
            <button
              key={result.cadastralRegNo}
              type="button"
              onClick={() => navigate(`/parcel/${encodeURIComponent(result.cadastralRegNo)}`)}
              className="rounded-xl border border-slate-200 bg-white px-5 py-4 text-left shadow-sm transition hover:border-teal-300 active:scale-[0.99]"
            >
              <p className="text-lg font-semibold text-slate-900">
                {result.address ?? "Adreso viešuose šaltiniuose nėra"}
              </p>
              <p className="text-base text-slate-600">{result.cadastralRegNo}</p>
            </button>
          ))}
        </div>
      </section>

      {history.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <PinIcon className="h-6 w-6 text-teal-600" />
            Neseniai peržiūrėta
          </h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {history.map((item) => (
              <li key={`${item.id}-${item.timestamp}`}>
                <Link
                  to={`/parcel/${encodeURIComponent(item.id)}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4 transition hover:border-teal-300 hover:bg-teal-50/30"
                >
                  <div className="min-w-0">
                    <p className="truncate text-lg font-semibold text-slate-800">{item.address}</p>
                    <p className="truncate text-base text-slate-500">{item.id}</p>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
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
  const [history, setHistory] = useLocalStorage<SearchHistoryItem[]>("zeme-search-history", []);

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
        <Link to="/" className="flex items-center gap-2 text-lg font-semibold text-teal-700 transition hover:text-teal-600">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-5 w-5" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Atgal į paiešką
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onRefresh}
            className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-lg font-semibold text-slate-900 transition hover:bg-slate-50 active:scale-[0.98]"
          >
            {loading ? "Atnaujinama…" : "Atnaujinti"}
          </button>
          {report?.pdfUrl ? (
            <a
              href={report.pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-teal-300 bg-teal-50 px-5 py-3 text-lg font-semibold text-teal-800 transition hover:bg-teal-100/80 active:scale-[0.98]"
            >
              Atsisiųsti PDF
            </a>
          ) : null}
        </div>
      </div>

      {!report && loading ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-slate-300 bg-white p-12 text-center">
          <Spinner />
          <p className="text-xl text-slate-600">Renkame sklypo duomenis…</p>
        </div>
      ) : null}

      {report ? (
        <>
          <SummaryCard report={report} />
          <ParcelMap report={report} />
          <section className="grid gap-6">
            <h2 className="text-2xl font-bold text-slate-900">Detali informacija</h2>
            <ReportPanel report={report} />
          </section>
          <p className="text-base text-slate-500">{freshness}</p>
        </>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <PinIcon className="h-6 w-6 text-teal-600" />
          Neseniai peržiūrėta
        </h2>
        {history.length === 0 ? (
          <p className="py-4 text-lg text-slate-500">Peržiūrų istorijos dar nėra.</p>
        ) : (
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {history.map((item) => (
              <li key={`${item.id}-${item.timestamp}`}>
                <Link
                  to={`/parcel/${encodeURIComponent(item.id)}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4 transition hover:border-teal-300 hover:bg-teal-50/30"
                >
                  <div className="min-w-0">
                    <p className="truncate text-lg font-semibold text-slate-800">{item.address}</p>
                    <p className="truncate text-base text-slate-500">{item.id}</p>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
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
    <div className="flex min-h-screen flex-col bg-slate-50/50">
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
