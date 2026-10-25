import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { CloseIcon, GitHubIcon, LogoMark, MenuIcon } from "./icons";

const NAV_LINKS = [
  { to: "/", label: "Pradžia" },
  { to: "/zemelapis", label: "Žemėlapis" },
  { to: "/duomenu-saltiniai", label: "Duomenų šaltiniai" },
];

/** Wordmark — reused by the header and anywhere the brand needs to appear. */
function Brand() {
  return (
    <Link
      to="/"
      className="flex items-center gap-2.5 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600"
      aria-label="Reginfo.lt, į pradžią"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-forest-700 text-white">
        <LogoMark className="h-6 w-6" />
      </span>
      <span className="font-display text-2xl font-bold tracking-tight text-mist-900">
        Reginfo<span className="text-forest-700">.lt</span>
      </span>
    </Link>
  );
}

// The current page is marked by colour and a soft fill, never a primary fill,
// so the reader always knows where they are.
function navLinkClass({ isActive }: { isActive: boolean }) {
  return `whitespace-nowrap rounded-lg px-3 py-2 text-lg font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600 ${
    isActive ? "bg-forest-50 text-forest-800" : "text-mist-700 hover:bg-mist-100 hover:text-mist-900"
  }`;
}

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-1100 w-full border-b border-mist-200 bg-mist-50/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-shell items-center justify-between px-4 md:px-8">
        <Brand />

        {/* Desktop nav — full width, everything fits above md. */}
        <nav className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} end className={navLinkClass}>
              {link.label}
            </NavLink>
          ))}
        </nav>

        {/* Mobile: a hamburger toggle instead of squeezing links into the bar. */}
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-label={menuOpen ? "Uždaryti meniu" : "Atverti meniu"}
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-mist-700 transition-colors hover:bg-mist-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600 active:bg-mist-200 md:hidden"
        >
          {menuOpen ? <CloseIcon className="h-6 w-6" /> : <MenuIcon className="h-6 w-6" />}
        </button>
      </div>

      {menuOpen ? (
        <nav className="flex flex-col gap-1 border-t border-mist-200 bg-mist-50 px-4 py-3 md:hidden">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end
              onClick={() => setMenuOpen(false)}
              className={(state) => `${navLinkClass(state)} block`}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      ) : null}
    </header>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-mist-200 bg-white">
      <div className="mx-auto flex max-w-shell flex-col items-start justify-between gap-4 px-4 py-6 md:flex-row md:items-center md:px-8">
        <p className="max-w-2xl text-base text-mist-600">
          Žemės sklypų ir pastatų informacija iš viešų Lietuvos registrų. Duomenys
          pateikiami pažintiniams tikslams ir nėra oficialus dokumentas.
        </p>
        <a
          href="https://github.com/FDiskas/zeme"
          target="_blank"
          rel="noreferrer"
          className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-mist-300 bg-white px-4 py-2.5 text-base font-semibold text-mist-800 transition-colors hover:border-forest-300 hover:text-forest-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600 active:bg-mist-100"
        >
          <GitHubIcon className="h-5 w-5" />
          GitHub
        </a>
      </div>
    </footer>
  );
}
