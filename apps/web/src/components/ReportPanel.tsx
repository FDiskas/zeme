import { Fragment, useState } from "react";
import type { ParcelReport } from "@zeme/shared";
import { Link } from "react-router-dom";
import {
  LONG_LIST,
  curateReport,
  type CuratedField,
  type CuratedItem,
  type CuratedPanel,
} from "../lib/report-format";
import { ArrowUpIcon, ChevronDown, InfoIcon, PinIcon, RefreshIcon, SourceIcon } from "./icons";

const formatDate = (iso: string) => new Date(iso).toISOString().slice(0, 10);

// The registry a citizen recognises, and how fresh its data are. The dataset's
// technical name (ntr_sklypai, CENSUS2021_…) is for whoever wants to verify,
// so it waits behind the ℹ key.
function SourceLine({ source, checkedAt }: { source: NonNullable<CuratedPanel["source"]>; checkedAt: string }) {
  return (
    <div className="flex items-start gap-2 text-sm text-muted">
      <SourceIcon className="mt-1 h-4 w-4 shrink-0" />
      <div className="min-w-0">
        <p>
          Šaltinis:{" "}
          {source.url ? (
            <a href={source.url} target="_blank" rel="noreferrer" className="link font-normal">
              {source.name}
            </a>
          ) : (
            source.name
          )}
          .{" "}
          {source.dataDate ? `Duomenų data: ${source.dataDate}.` : `Patikrinta ${formatDate(checkedAt)}.`}
        </p>
        <details className="group">
          <summary className="inline-flex cursor-pointer list-none [&::-webkit-details-marker]:hidden items-center gap-1.5 rounded-pill py-1 hover:text-ink focus-visible:outline-2 focus-visible:outline-focus">
            <InfoIcon className="h-4 w-4 shrink-0" />
            <span className="underline decoration-rule underline-offset-4">Techninis pavadinimas</span>
          </summary>
          <p className="code wrap-break-word">{source.api}</p>
        </details>
      </div>
    </div>
  );
}

type Props = {
  report: ParcelReport;
  /** Ask the sources again, offered on a panel whose source failed. */
  onRetry?: () => void;
  /** When asking again is not allowed yet: the time it will be ("18:32"). */
  retryAfter?: string;
  retrying?: boolean;
};

function FieldValue({ value, isLink, href, externalHref }: { value: string; isLink?: boolean; href?: string; externalHref?: string }) {
  if (externalHref) {
    return (
      <a href={externalHref} target="_blank" rel="noreferrer" className={`link ${/\s/.test(value) ? "wrap-break-word" : "whitespace-nowrap"}`}>
        {value}
      </a>
    );
  }
  if (href) {
    return (
      <Link to={href} className="link inline-flex items-start gap-1.5">
        <PinIcon className="mt-1 h-5 w-5 shrink-0" />
        <span className="wrap-break-word">{value}</span>
      </Link>
    );
  }
  if (isLink && /^https?:\/\//i.test(value)) {
    return (
      <a href={value} target="_blank" rel="noreferrer" className="link wrap-break-word">
        Atidaryti nuorodą
      </a>
    );
  }
  return <span className="wrap-break-word">{value}</span>;
}

// A list of names (protected areas, heritage objects) as tags, each once.
function Tags({ tags }: { tags: string[] }) {
  return (
    <ul className="mt-1 flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <li key={tag} className="chip min-h-0 py-1 whitespace-normal text-ink">
          {tag}
        </li>
      ))}
    </ul>
  );
}

function Fields({ fields }: { fields: CuratedField[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 @sm:grid-cols-2">
      {fields.map((field) => (
        <div key={field.label} className={`flex min-w-0 flex-col${field.wide ? " @sm:col-span-2" : ""}`}>
          <dt className="text-sm text-muted">{field.label}</dt>
          <dd className="text-md text-ink">
            {field.tags ? (
              <Tags tags={field.tags} />
            ) : (
              <FieldValue value={field.value} isLink={field.isLink} href={field.href} externalHref={field.externalHref} />
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

// A heading exists only where a field rule opted in (isHeading), so it is
// shown even for a panel's single item — it carries data (a permit's type, a
// broadband technology), not a repeat of the panel title. Items part with a
// hairline rather than a box, so a panel never nests a card inside a card.
function ItemBlock({ item }: { item: CuratedItem }) {
  return (
    <div className="@container py-3 first:pt-0">
      {item.heading ? (
        <p className="mb-2 text-md font-medium text-ink">{item.heading}</p>
      ) : null}
      <Fields fields={item.fields} />
    </div>
  );
}

// One record of a long list on one or two lines — date · name, then what it
// is, its status, its address — opening for the rest of its fields. A list of
// hundreds stays scannable instead of ten lines per record.
function CompactRow({ item }: { item: CuratedItem }) {
  const rowFields = item.fields.filter((field) => field.inRow);
  const rest = item.fields.filter((field) => !field.inRow);
  const meta = rowFields.map((field) => field.value).join(" · ");
  const line = (
    <span className="grid min-w-0 flex-1">
      <span className="text-md font-medium text-ink">{item.heading ?? rowFields[0]?.value}</span>
      {meta && item.heading ? <span className="line-clamp-2 text-sm text-ink-2">{meta}</span> : null}
    </span>
  );

  if (rest.length === 0) return <div className="flex py-2.5">{line}</div>;
  return (
    <details className="report-disclosure @container">
      <summary className="-mx-2 flex cursor-pointer list-none items-center gap-3 px-2 py-2 transition-colors duration-150 hover:bg-paper focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus">
        {line}
        <ChevronDown className="report-chevron h-5 w-5 shrink-0 text-ink" />
      </summary>
      <div className="pb-3">
        <Fields fields={rest} />
      </div>
    </details>
  );
}

type Filter = { text: string; year: string; kind: string };
const NO_FILTER: Filter = { text: "", year: "", kind: "" };

function matches(item: CuratedItem, filter: Filter): boolean {
  if (filter.year && item.year !== filter.year) return false;
  if (filter.kind && item.kind !== filter.kind) return false;
  if (!filter.text) return true;
  const haystack = [item.heading, ...item.fields.map((field) => field.value)].join(" ").toLocaleLowerCase("lt");
  return haystack.includes(filter.text.trim().toLocaleLowerCase("lt"));
}

// Distinct values, most frequent first (document kinds) or newest first (years).
function options(values: (string | undefined)[], order: "count" | "desc"): string[] {
  const counts = new Map<string, number>();
  for (const value of values) if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  const keys = [...counts.keys()];
  return order === "desc" ? keys.sort((a, b) => b.localeCompare(a)) : keys.sort((a, b) => counts.get(b)! - counts.get(a)!);
}

// Search, year and document type over a long list. Only the choices the list
// actually holds are offered, and a choice with a single option is left out.
function ListFilters({ panel, filter, onChange }: { panel: CuratedPanel; filter: Filter; onChange: (next: Filter) => void }) {
  const years = options(panel.items.map((item) => item.year), "desc");
  const kinds = options(panel.items.map((item) => item.kind), "count");
  const id = `filter-${panel.key}`;
  const selectClass = "field min-h-12 w-full text-md";

  return (
    <div className="grid gap-3 pb-3 sm:grid-cols-2">
      <label htmlFor={`${id}-text`} className="grid gap-1 sm:col-span-2">
        <span className="text-sm text-muted">Ieškoti sąraše (adresas, pavadinimas, Nr.)</span>
        <input
          id={`${id}-text`}
          type="search"
          value={filter.text}
          onChange={(event) => onChange({ ...filter, text: event.target.value })}
          className="field min-h-12 w-full text-md"
        />
      </label>
      {years.length > 1 ? (
        <label htmlFor={`${id}-year`} className="grid gap-1">
          <span className="text-sm text-muted">Metai</span>
          <select id={`${id}-year`} value={filter.year} onChange={(event) => onChange({ ...filter, year: event.target.value })} className={selectClass}>
            <option value="">Visi metai</option>
            {years.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </label>
      ) : null}
      {kinds.length > 1 ? (
        <label htmlFor={`${id}-kind`} className="grid gap-1">
          <span className="text-sm text-muted">Dokumento tipas</span>
          <select id={`${id}-kind`} value={filter.kind} onChange={(event) => onChange({ ...filter, kind: event.target.value })} className={selectClass}>
            <option value="">Visi tipai</option>
            {kinds.map((kind) => (
              <option key={kind} value={kind}>{kind}</option>
            ))}
          </select>
        </label>
      ) : null}
    </div>
  );
}

// How many records an opened panel shows at first: a few full cards, or a
// page of one-line rows, so one panel never floods the column. A long list
// (LONG_LIST records) offers filters too.
const FIRST_ITEMS = 3;
const ROWS_PER_PAGE = 10;

type PanelProps = { panel: CuratedPanel; checkedAt: string; onRetry?: () => void; retryAfter?: string; retrying: boolean };

function Panel({ panel, checkedAt, onRetry, retryAfter, retrying }: PanelProps) {
  const [shown, setShown] = useState(panel.compact ? ROWS_PER_PAGE : FIRST_ITEMS);
  const [filter, setFilter] = useState<Filter>(NO_FILTER);

  // Empty or upstream-unavailable panels: one quiet row, not an expandable
  // one, so they don't add clutter or imply hidden content. The source is
  // intentionally omitted here; it only appears inside an expanded panel. A
  // failed source gets a key to ask again.
  if (panel.state !== "ok") {
    const failed = panel.state === "unavailable";
    return (
      <li id={`panel-${panel.key}`} className="grid scroll-mt-[calc(var(--nav-clear)+1rem)] justify-items-start gap-1 px-2 py-2.5">
        <span className="text-md text-ink-2">{panel.title}</span>
        {panel.message ? <span className="line-clamp-3 text-sm text-muted">{panel.message}</span> : null}
        {failed && onRetry ? (
          <button type="button" onClick={onRetry} disabled={retrying} aria-busy={retrying} className="btn btn--secondary btn--s mt-1">
            <RefreshIcon className="h-5 w-5" />
            {retrying ? "Bandoma…" : "Bandyti dar kartą"}
          </button>
        ) : failed && retryAfter ? (
          <span className="text-sm text-muted">Bandyti dar kartą galėsite po {retryAfter}</span>
        ) : null}
      </li>
    );
  }

  const filterable = panel.compact && panel.items.length >= LONG_LIST;
  const matching = filterable ? panel.items.filter((item) => matches(item, filter)) : panel.items;
  const items = matching.slice(0, shown);
  const hidden = matching.length - items.length;
  const groupSize = (group: string) => matching.filter((item) => item.group === group).length;
  const Item = panel.compact ? CompactRow : ItemBlock;

  function changeFilter(next: Filter) {
    setFilter(next);
    setShown(ROWS_PER_PAGE);
  }

  // The finding comes first: the panel's plain-language insight sits in the
  // row itself, so most readers never need to open it.
  return (
    <li>
      <details id={`panel-${panel.key}`} className="report-disclosure scroll-mt-[calc(var(--nav-clear)+1rem)]">
        <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-2 py-2 transition-colors duration-150 hover:bg-paper-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus active:bg-paper-3">
          <span className="grid min-w-0 flex-1 gap-0.5">
            <span className="text-md font-medium text-ink">{panel.title}</span>
            {panel.insight ? <span className="report-insight line-clamp-2 text-sm text-ink-2">{panel.insight}</span> : null}
          </span>{" "}
          {panel.countLabel ? <span className="chip min-h-8 shrink-0 px-2.5 py-1.5 whitespace-nowrap">{panel.countLabel}</span> : null}
          <ChevronDown className="report-chevron h-5 w-5 shrink-0 text-ink" />
        </summary>
        {/* The opened body is a white sheet with a hairline edge, so it never
            runs into the row's grey hover above it. */}
        <div className="mx-2 mb-3 divide-y divide-rule rounded-card border border-rule bg-plate px-4 pt-3 pb-2">
          {filterable ? <ListFilters panel={panel} filter={filter} onChange={changeFilter} /> : null}
          {filterable && matching.length === 0 ? <p className="py-3 text-md text-ink-2">Pagal pasirinktus filtrus įrašų nerasta.</p> : null}
          {items.map((item, i) => (
            <Fragment key={i}>
              {/* A stage sub-heading opens each run of items in the same group;
                  it sits flush on its first item, with no hairline between. */}
              {item.group && item.group !== items[i - 1]?.group ? (
                <p className="border-b-0 pt-4 pb-1 text-md font-semibold text-ink first:pt-0">
                  {item.group} ({groupSize(item.group)})
                </p>
              ) : null}
              <Item item={item} />
            </Fragment>
          ))}
          {hidden > 0 ? (
            <div className="py-3">
              <button
                type="button"
                onClick={() => setShown((count) => (panel.compact ? count + ROWS_PER_PAGE * 2 : matching.length))}
                className="btn btn--secondary btn--s"
              >
                {panel.compact ? `Rodyti daugiau (liko ${hidden})` : `Rodyti visus (${matching.length})`}
              </button>
            </div>
          ) : null}
          {panel.note ? <p className="py-3 text-sm text-ink-2">{panel.note}</p> : null}
          {panel.source ? (
            <div className="pt-3">
              <SourceLine source={panel.source} checkedAt={checkedAt} />
            </div>
          ) : null}
        </div>
      </details>
    </li>
  );
}

const isPlainEmpty = (panel: CuratedPanel) => panel.state === "empty" && !panel.message;

const generatedAt = (iso: string) =>
  new Intl.DateTimeFormat("lt-LT", { year: "numeric", month: "long", day: "numeric" }).format(new Date(iso));

// Panels that found nothing and have nothing more to say, gathered into one
// "Nerasta: …" line so they don't each take a row. Each keeps its anchor, so
// a summary flag can still jump to it.
function NothingFound({ panels }: { panels: CuratedPanel[] }) {
  return (
    <li className="px-2 py-2.5 text-md text-ink-2">
      {panels.map((panel) => (
        <span key={panel.key} id={`panel-${panel.key}`} className="scroll-mt-[calc(var(--nav-clear)+1rem)]" />
      ))}
      <span className="font-medium text-ink">Nerasta:</span> {panels.map((panel) => panel.title).join(", ")}
    </li>
  );
}

export function ReportPanel({ report, onRetry, retryAfter, retrying = false }: Props) {
  const categories = curateReport(report);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8">
      {/* Table of contents: every section one tap away, all of them in view,
          as quiet pills so the row reads as a menu, not five more keys. */}
      <nav aria-label="Ataskaitos skyriai">
        <ul className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <li key={category.id} className="shrink-0">
              <a href={`#skyrius-${category.id}`} className="pill-link">
                {category.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {categories.map((category) => (
        <section key={category.id} id={`skyrius-${category.id}`} className="grid scroll-mt-[calc(var(--nav-clear)+1rem)] gap-2">
          <h3 className="text-lg leading-tight">{category.title}</h3>
          <ul className="spec">
            {category.panels
              .filter((panel) => !isPlainEmpty(panel))
              .map((panel) => (
                <Panel key={panel.key} panel={panel} checkedAt={report.fetchedAt} onRetry={onRetry} retryAfter={retryAfter} retrying={retrying} />
              ))}
            {category.panels.some(isPlainEmpty) ? <NothingFound panels={category.panels.filter(isPlainEmpty)} /> : null}
          </ul>
        </section>
      ))}

      <footer className="grid gap-4 border-t border-edge pt-6 text-sm text-ink-2">
        {/* The Lithuanian long date already ends in "d.", so no closing period. */}
        <p>Ataskaita sugeneruota {generatedAt(report.fetchedAt)}</p>
        <p>
          Ataskaita sudaryta iš viešų valstybės registrų duomenų. Duomenys gali keistis, todėl prieš
          priimdami svarbų sprendimą (pirkdami, statydami) informaciją pasitikrinkite pirminiuose
          šaltiniuose: Nekilnojamojo turto registre, savivaldybėje ar pas matininką.
        </p>
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="btn btn--secondary btn--s w-fit"
        >
          <ArrowUpIcon className="h-5 w-5" />
          Grįžti į viršų
        </button>
      </footer>
    </div>
  );
}
