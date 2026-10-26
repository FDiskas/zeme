/**
 * Shared icon set.
 *
 * One family, one visual language: every outline icon uses a 24×24 viewBox and
 * `stroke-width: 2`, so they stay consistent wherever they appear (ui-ux rule
 * icon-style-consistent). Size and colour come from `className` via Tailwind
 * (e.g. `h-6 w-6 text-ink`) — the icons never hard-code either.
 */

type IconProps = { className?: string };

function Outline({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/** Brand mark: a surveyed parcel (its outline and corner points) with a
 *  house on it. Colours come from the tokens through the class names. */
export function LogoMark({ className }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path
        d="M4.5 11 17 4.5l10.5 7.5-2.5 15.5-17.5-1.5Z"
        className="fill-accent-soft stroke-accent"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <path
        d="M12 25.5v-6.5l4.5-3.5 4.5 3.5v6.5"
        className="fill-none stroke-ink"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <g className="fill-accent">
        <circle cx="4.5" cy="11" r="2.5" />
        <circle cx="17" cy="4.5" r="2.5" />
        <circle cx="27.5" cy="12" r="2.5" />
        <circle cx="25" cy="27.5" r="2.5" />
        <circle cx="7.5" cy="26" r="2.5" />
      </g>
    </svg>
  );
}

export function PinIcon({ className }: IconProps) {
  return (
    <Outline className={className}>
      <path d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
      <path d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
    </Outline>
  );
}

/** Map base layers: the street map or the orthophoto. */
export function LayersIcon({ className }: IconProps) {
  return (
    <Outline className={className}>
      <path d="M12 3l9 4.5-9 4.5-9-4.5L12 3z" />
      <path d="M3 12l9 4.5 9-4.5" />
      <path d="M3 16.5L12 21l9-4.5" />
    </Outline>
  );
}

/** Bring the parcel back into view. */
export function CrosshairIcon({ className }: IconProps) {
  return (
    <Outline className={className}>
      <path d="M12 19a7 7 0 100-14 7 7 0 000 14z" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
      <path d="M12 13a1 1 0 100-2 1 1 0 000 2z" />
    </Outline>
  );
}

export function SearchIcon({ className }: IconProps) {
  return (
    <Outline className={className}>
      <path d="M21 21l-4.35-4.35M11 18a7 7 0 110-14 7 7 0 010 14z" />
    </Outline>
  );
}

export function RefreshIcon({ className }: IconProps) {
  return (
    <Outline className={className}>
      <path d="M4 4v5h5M20 20v-5h-5" />
      <path d="M19 9a8 8 0 00-14-3L4 9M5 15a8 8 0 0014 3l1-3" />
    </Outline>
  );
}

export function DownloadIcon({ className }: IconProps) {
  return (
    <Outline className={className}>
      <path d="M12 3v12m0 0l-4-4m4 4l4-4" />
      <path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
    </Outline>
  );
}

export function CopyIcon({ className }: IconProps) {
  return (
    <Outline className={className}>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2" />
    </Outline>
  );
}

export function ShareIcon({ className }: IconProps) {
  return (
    <Outline className={className}>
      <path d="M12 3v12M8 7l4-4 4 4" />
      <path d="M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
    </Outline>
  );
}

export function ArrowUpIcon({ className }: IconProps) {
  return (
    <Outline className={className}>
      <path d="M12 20V5M5 12l7-7 7 7" />
    </Outline>
  );
}

export function ChevronRight({ className }: IconProps) {
  return (
    <Outline className={className}>
      <path d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </Outline>
  );
}

export function ChevronLeft({ className }: IconProps) {
  return (
    <Outline className={className}>
      <path d="M15.75 19.5L8.25 12l7.5-7.5" />
    </Outline>
  );
}

export function ChevronDown({ className }: IconProps) {
  return (
    <Outline className={className}>
      <path d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </Outline>
  );
}

export function MenuIcon({ className }: IconProps) {
  return (
    <Outline className={className}>
      <path d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
    </Outline>
  );
}

export function PlusIcon({ className }: IconProps) {
  return (
    <Outline className={className}>
      <path d="M12 4.5v15m7.5-7.5h-15" />
    </Outline>
  );
}

export function MinusIcon({ className }: IconProps) {
  return (
    <Outline className={className}>
      <path d="M19.5 12h-15" />
    </Outline>
  );
}

export function CloseIcon({ className }: IconProps) {
  return (
    <Outline className={className}>
      <path d="M6 18L18 6M6 6l12 12" />
    </Outline>
  );
}

export function CheckIcon({ className }: IconProps) {
  return (
    <Outline className={className}>
      <path d="M4.5 12.75l6 6 9-13.5" />
    </Outline>
  );
}

export function WarningIcon({ className }: IconProps) {
  return (
    <Outline className={className}>
      <path d="M12 9v3.75m0 3.75h.008M10.34 3.94l-7.6 13.16A1.5 1.5 0 004.04 19.5h15.92a1.5 1.5 0 001.3-2.4L13.66 3.94a1.5 1.5 0 00-2.6 0z" />
    </Outline>
  );
}

export function InfoIcon({ className }: IconProps) {
  return (
    <Outline className={className}>
      <path d="M12 21a9 9 0 100-18 9 9 0 000 18z" />
      <path d="M12 11v5M12 8h.01" />
    </Outline>
  );
}

export function SourceIcon({ className }: IconProps) {
  return (
    <Outline className={className}>
      <path d="M12 6.5c4.5 0 8-1.6 8-3.25S16.5 0 12 0 4 1.6 4 3.25 7.5 6.5 12 6.5z" transform="translate(0 3.25)" />
      <path d="M4 6.375v11.25C4 19.4 7.5 21 12 21s8-1.6 8-3.375V6.375" />
      <path d="M4 12c0 1.775 3.5 3.375 8 3.375S20 13.775 20 12" />
    </Outline>
  );
}

export function Spinner({ className }: IconProps) {
  return (
    <span
      className={
        className ??
        "h-10 w-10 animate-spin rounded-full border-4 border-paper-3 border-t-ink"
      }
      role="status"
      aria-label="Kraunama"
    />
  );
}
