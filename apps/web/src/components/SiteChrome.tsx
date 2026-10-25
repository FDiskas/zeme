import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { CloseIcon, LogoMark, MenuIcon } from "./icons";

const NAV_LINKS = [
  { to: "/", label: "Pradžia" },
  { to: "/zemelapis", label: "Žemėlapis" },
  { to: "/duomenu-saltiniai", label: "Duomenų šaltiniai" },
];

/** Wordmark — reused by the header and the footer. */
function Brand() {
  return (
    <Link
      to="/"
      className="flex shrink-0 items-center gap-3 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus"
      aria-label="Reginfo.lt, į pradžią"
    >
      <span className="flex h-10 w-10 items-center justify-center bg-ink text-paper">
        <LogoMark className="h-6 w-6" />
      </span>
      <span className="font-display text-xl font-bold tracking-display text-ink">Reginfo.lt</span>
    </Link>
  );
}

// The current page takes the soft rust wash, never a filled primary, so the
// reader always knows where they are without the link shouting.
function navLinkClass({ isActive }: { isActive: boolean }) {
  return `flex min-h-12 items-center whitespace-nowrap px-4 text-md font-medium text-ink transition-colors duration-150 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus active:bg-paper-3 ${
    isActive ? "bg-accent-soft" : "hover:bg-paper-2"
  }`;
}

// A floating bar: the wordmark and three links on a ruled plate, held a step
// off the top edge. The band around the plate is paper, not glass, so content
// scrolling up disappears behind it instead of showing through the gaps; its
// full height is --nav-clear, where sticky panes start.
export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-(--z-sticky-nav) bg-paper py-3">
      <div className="container">
        <div className="border-2 border-ink bg-plate">
          <div className="flex h-16 items-center justify-between gap-4 pr-2 pl-3">
            <Brand />

            <nav aria-label="Pagrindinė" className="hidden items-center gap-1 md:flex">
              {NAV_LINKS.map((link) => (
                <NavLink key={link.to} to={link.to} end className={navLinkClass}>
                  {link.label}
                </NavLink>
              ))}
            </nav>

            {/* Phones: a menu toggle instead of squeezing links into the bar. */}
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-controls="mobile-nav"
              aria-label={menuOpen ? "Uždaryti meniu" : "Atverti meniu"}
              className="inline-flex h-12 w-12 items-center justify-center text-ink transition-colors duration-150 hover:bg-paper-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus active:bg-paper-3 md:hidden"
            >
              {menuOpen ? <CloseIcon className="h-6 w-6" /> : <MenuIcon className="h-6 w-6" />}
            </button>
          </div>

          {menuOpen ? (
            <nav id="mobile-nav" aria-label="Pagrindinė" className="grid border-t border-rule p-2 md:hidden">
              {NAV_LINKS.map((link) => (
                <NavLink key={link.to} to={link.to} end onClick={() => setMenuOpen(false)} className={navLinkClass}>
                  {link.label}
                </NavLink>
              ))}
            </nav>
          ) : null}
        </div>
      </div>
    </header>
  );
}

// A colophon: the wordmark, then one paragraph that says what the data is,
// what it is not, and whose map and code it stands on.
export function Footer() {
  return (
    <footer className="border-t-2 border-ink bg-paper-2">
      <div className="container grid gap-8 py-16 md:grid-cols-12 md:gap-8">
        <div className="md:col-span-4">
          <Brand />
        </div>
        <p className="max-w-[60ch] text-md text-ink-2 md:col-span-7 md:col-start-6">
          Žemės sklypų ir pastatų informacija iš viešų Lietuvos registrų. Duomenys
          pateikiami pažintiniams tikslams ir nėra oficialus dokumentas. Žemėlapio
          pagrindas:{" "}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="link">
            OpenStreetMap
          </a>
          . Programos kodas atviras:{" "}
          <a href="https://github.com/FDiskas/zeme" target="_blank" rel="noreferrer" className="link">
            GitHub
          </a>
          .
        </p>
      </div>
    </footer>
  );
}
