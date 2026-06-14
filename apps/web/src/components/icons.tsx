/**
 * Shared icon set.
 *
 * One family, one visual language: every outline icon uses a 24×24 viewBox and
 * `stroke-width: 2`, so they stay consistent wherever they appear (ui-ux rule
 * icon-style-consistent). Size and colour come from `className` via Tailwind
 * (e.g. `h-6 w-6 text-forest-600`) — the icons never hard-code either.
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

/** Brand mark: a parcel of land with a building on it. */
export function LogoMark({ className }: IconProps) {
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
      {/* land / parcel outline */}
      <path d="M3 20.5h18" />
      {/* the plot */}
      <path d="M4.5 20.5l1.2-9 6.3-3.5 6.3 3.5 1.2 9" />
      {/* building roof + body */}
      <path d="M9.5 20.5v-5.5h5v5.5" />
      <path d="M12 4.5v3.5" />
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

export function GitHubIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.009-.868-.014-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

export function Spinner({ className }: IconProps) {
  return (
    <span
      className={
        className ??
        "h-10 w-10 animate-spin rounded-full border-4 border-mist-200 border-t-forest-600 motion-reduce:animate-none"
      }
      role="status"
      aria-label="Kraunama"
    />
  );
}
