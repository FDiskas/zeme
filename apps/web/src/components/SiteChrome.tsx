import { Link } from "react-router-dom";
import { GitHubIcon, LogoMark } from "./icons";

/** Wordmark — reused by the header and anywhere the brand needs to appear. */
function Brand() {
  return (
    <Link
      to="/"
      className="flex items-center gap-3 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-600"
      aria-label="Reginfo.lt — į pradžią"
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-clay-600 text-white shadow-sm">
        <LogoMark className="h-6 w-6" />
      </span>
      <span className="font-serif text-2xl font-bold tracking-tight text-sand-900">
        Reginfo
        <span className="ml-0.5 text-base font-semibold uppercase tracking-widest text-clay-700">
          .lt
        </span>
      </span>
    </Link>
  );
}

export function Header() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-sand-200 bg-sand-50/85 backdrop-blur-md">
      <div className="mx-auto flex h-18 max-w-6xl items-center justify-between px-4 md:px-8">
        <Brand />
        <nav className="flex items-center gap-1">
          <Link
            to="/"
            className="rounded-lg px-3 py-2 text-lg font-semibold text-sand-700 transition hover:bg-sand-100 hover:text-clay-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-600"
          >
            Pradžia
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-4 border-t border-sand-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-center md:flex-row md:px-8 md:text-left">
        <p className="max-w-xl text-base text-sand-600">
          reginfo.lt — žemės sklypų ir pastatų informacija iš viešų Lietuvos registrų.
          Duomenys teikiami susipažinti ir nėra oficialus dokumentas.
        </p>
        <a
          href="https://github.com/FDiskas/zeme"
          target="_blank"
          rel="noreferrer"
          className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-sand-300 bg-white px-4 py-2.5 text-base font-semibold text-sand-800 transition hover:border-clay-300 hover:text-clay-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-600"
        >
          <GitHubIcon className="h-5 w-5" />
          Projektas GitHub
        </a>
      </div>
    </footer>
  );
}
