import { useId, useState, type ReactNode } from "react";
import { InfoIcon } from "./icons";

type Props = {
  /** The label the note belongs to; the bubble opens under its start, so it
   *  stays on a phone's screen. */
  children: ReactNode;
  /** What the note explains, for screen readers: "Užstatytas plotas". */
  about: string;
  /** The note, one line per entry. */
  lines: string[];
  /** Which edge the bubble keeps to: start for a left column, end for a right one. */
  align?: "start" | "end";
};

// A small "i" that explains a value without lengthening the card. The note
// opens on hover (CSS, .tip in index.css) and on a press, tap or Enter, which
// toggles it, so it works with a mouse, a finger and a keyboard. Escape or
// leaving the key closes it.
export function InfoTip({ children, about, lines, align = "start" }: Props) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <span className={`tip inline-flex items-center gap-1.5 align-middle${align === "end" ? " tip--end" : ""}`} data-open={open}>
      {children}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => event.key === "Escape" && setOpen(false)}
        aria-label={`Daugiau apie: ${about}`}
        aria-describedby={id}
        aria-expanded={open}
        className="-m-2 inline-grid h-9 w-9 place-items-center rounded-full text-muted transition-colors duration-150 hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-focus"
      >
        <InfoIcon className="h-4 w-4" />
      </button>
      <span id={id} role="tooltip" className="tip__bubble">
        {lines.map((line) => (
          <span key={line} className="block">{line}</span>
        ))}
      </span>
    </span>
  );
}
