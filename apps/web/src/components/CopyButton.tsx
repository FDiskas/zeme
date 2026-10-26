import { useState } from "react";
import { CopyIcon } from "./icons";

type Props = {
  text: string;
  /** What is copied, for screen readers: "Kopijuoti kadastrinį numerį". */
  label: string;
  className?: string;
};

// A quiet "Kopijuoti" key that says "Nukopijuota" for two seconds. When the
// clipboard is blocked (insecure context, denied permission) the text stays
// on screen to copy by hand, so nothing is reported.
export function CopyButton({ text, label, className = "link" }: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // See above: nothing to do.
    }
  }

  return (
    <button type="button" onClick={copy} aria-label={copied ? undefined : label} className={`${className} inline-flex w-fit items-center gap-1.5 font-body text-sm`}>
      <CopyIcon className="h-4 w-4 shrink-0" />
      <span aria-live="polite">{copied ? "Nukopijuota" : "Kopijuoti"}</span>
    </button>
  );
}
