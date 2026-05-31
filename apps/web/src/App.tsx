import { useEffect, useMemo, useState } from "react";
import { Link, Route, Routes, useNavigate, useParams } from "react-router-dom";
import type { ParcelReport, ParcelSearchItem } from "@zeme/shared";
import { ParcelMap } from "./components/ParcelMap";
import { ReportPanel } from "./components/ReportPanel";
import { orpcClient } from "./lib/orpc";
import { useLocalStorage } from "./lib/useLocalStorage";

type SearchHistoryItem = {
  id: string;
  address: string;
  timestamp: number;
};

function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-8">
        <Link to="/" className="group flex items-center gap-3 transition">
          {/* Stunning abstract land/leaf/map custom SVG logo */}
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-teal-500/20 transition-all duration-300 group-hover:scale-105 group-hover:shadow-teal-500/30">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2.5"
              stroke="currentColor"
              className="h-5 w-5 transition-transform duration-500 group-hover:rotate-12"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.61c-.38.19-.622.58-.622 1.006v12.022c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z"
              />
            </svg>
          </div>
          <span className="bg-gradient-to-r from-slate-900 to-teal-800 bg-clip-text text-xl font-extrabold tracking-tight text-transparent transition duration-300 group-hover:text-teal-600">
            Žemė
            <span className="text-xs font-semibold uppercase tracking-widest text-teal-600/80 ml-1">
              .lt
            </span>
          </span>
        </Link>
        <nav className="flex items-center gap-6">
          <Link
            to="/"
            className="text-sm font-semibold text-slate-600 transition hover:text-teal-600"
          >
            Home
          </Link>
          <a
            href="https://github.com/vkuciauskas/zeme"
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800"
          >
            GitHub
          </a>
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
  
  const [history] = useLocalStorage<SearchHistoryItem[]>(
    "zeme-search-history",
    [],
  );

  async function onSearch() {
    if (query.trim().length < 2) return;
    setLoading(true);
    setSearchNote(null);
    try {
      const data = await orpcClient.parcel.autocomplete({ query: query.trim() });
      setResults(data);
      if (data.length === 0) {
        setSearchNote(
          "No public unauthenticated address-to-cadastral source is currently available. Search by cadastral number, for example 4400/0001:0007.",
        );
      }
    } catch {
      setResults([]);
      setSearchNote("Autocomplete is temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 md:px-8">
      <section className="rounded-3xl border border-slate-300 bg-gradient-to-br from-emerald-100 via-teal-50 to-cyan-50 p-6 shadow-sm md:p-10">
        <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Zeme LT</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900 md:text-5xl">
          Real Estate and Land Parcel Due Diligence
        </h1>
        <p className="mt-4 max-w-3xl text-slate-700">
          Search Lithuanian parcels, inspect boundaries, and generate consolidated due diligence reports with a six-month cache strategy.
        </p>

        <div className="mt-6 flex flex-col gap-3 md:flex-row">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by address or cadastral identifier"
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none ring-teal-500 transition focus:ring"
          />
          <button
            type="button"
            onClick={onSearch}
            className="rounded-xl bg-teal-600 px-5 py-3 font-semibold text-white transition hover:bg-teal-500"
          >
            {loading ? "Searching..." : "Search Parcels"}
          </button>
        </div>

        <div className="mt-6 grid gap-2">
          {searchNote ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {searchNote}
            </p>
          ) : null}

          {results.map((result) => (
            <button
              key={result.cadastralRegNo}
              type="button"
              onClick={() => navigate(`/parcel/${encodeURIComponent(result.cadastralRegNo)}`)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-teal-300"
            >
              <p className="font-semibold text-slate-900">
                {result.address ?? "Address unavailable from current public sources"}
              </p>
              <p className="text-sm text-slate-600">{result.cadastralRegNo}</p>
            </button>
          ))}
        </div>
      </section>

      {history.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2"
              stroke="currentColor"
              className="h-5 w-5 text-teal-600 animate-pulse"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Recent Lookups
          </h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {history.map((item) => (
              <li key={`${item.id}-${item.timestamp}`}>
                <Link
                  to={`/parcel/${encodeURIComponent(item.id)}`}
                  className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 p-4 transition hover:border-teal-300 hover:bg-teal-50/30 group"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-600 transition group-hover:bg-teal-100">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth="2"
                        stroke="currentColor"
                        className="h-5 w-5"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
                        />
                      </svg>
                    </div>
                    <div className="overflow-hidden">
                      <p className="font-semibold text-slate-800 group-hover:text-teal-900 truncate">
                        {item.address}
                      </p>
                      <p className="text-xs text-slate-500 truncate">{item.id}</p>
                    </div>
                  </div>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="2.5"
                    stroke="currentColor"
                    className="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-teal-600"
                  >
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
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useLocalStorage<SearchHistoryItem[]>(
    "zeme-search-history",
    [],
  );

  async function fetchReport(forceRefresh = false) {
    if (!cadastralRegNo) return;

    setLoading(true);
    try {
      const data = await orpcClient.parcel.getReport({ cadastralRegNo, forceRefresh });
      setReport(data);

      setHistory((prev) => {
        const next = [
          {
            id: data.cadastralRegNo,
            address: data.address,
            timestamp: Date.now(),
          },
          ...prev.filter((entry) => entry.id !== data.cadastralRegNo),
        ];

        return next.slice(0, 10);
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchReport(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cadastralRegNo]);

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8 md:px-8">
      <header className="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm">
        <p className="text-sm uppercase tracking-wide text-slate-500">Shareable object URL</p>
        <h1 className="text-2xl font-bold text-slate-900">/parcel/{cadastralRegNo}</h1>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => fetchReport(false)}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            {loading ? "Loading..." : "Get Information"}
          </button>
          <button
            type="button"
            onClick={() => fetchReport(true)}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
          >
            Force Refresh
          </button>
          {report?.pdfUrl ? (
            <a
              href={report.pdfUrl}
              className="rounded-lg border border-teal-300 bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-800 transition hover:bg-teal-100/80"
              target="_blank"
              rel="noreferrer"
            >
              Download PDF
            </a>
          ) : null}
        </div>
      </header>

      {report ? <ParcelMap report={report} /> : null}

      {report ? (
        <section className="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
            <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold">{report.address}</span>
            <span className="rounded-full bg-slate-100 px-3 py-1">{report.cadastralRegNo}</span>
            <span className="rounded-full bg-slate-100 px-3 py-1">
              {report.cached ? `Cached (${report.cacheAgeDays ?? 0}d old)` : "Fresh"}
            </span>
          </div>
          <p className="mt-3 text-sm text-slate-600">Sources: {report.sources.join(", ")}</p>
        </section>
      ) : null}

      {report ? <ReportPanel report={report} /> : null}

      <section className="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2 mb-3">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="2"
            stroke="currentColor"
            className="h-5 w-5 text-teal-600"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Recent Lookups
        </h2>
        {history.length === 0 ? (
          <p className="text-slate-500 text-sm py-4">No recent searches yet.</p>
        ) : (
          <ul className="mt-3 grid gap-3">
            {history.map((item) => (
              <li key={`${item.id}-${item.timestamp}`}>
                <Link
                  to={`/parcel/${encodeURIComponent(item.id)}`}
                  className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3 transition hover:border-teal-300 hover:bg-teal-50/30 group"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600 transition group-hover:bg-teal-100">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth="2"
                        stroke="currentColor"
                        className="h-4 w-4"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
                        />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 group-hover:text-teal-900">
                        {item.address}
                      </p>
                      <p className="text-xs text-slate-500">{item.id}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-slate-400 hidden sm:inline">
                      {new Date(item.timestamp).toLocaleString()}
                    </span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth="2.5"
                      stroke="currentColor"
                      className="h-4 w-4 text-slate-400 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-teal-600"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function App() {
  return (
    <div className="min-h-screen bg-slate-50/50 pb-16">
      <Header />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/parcel/:cadastralRegNo" element={<ParcelPage />} />
      </Routes>
    </div>
  );
}

export default App;
