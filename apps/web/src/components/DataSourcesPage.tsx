import { DATA_SOURCES } from "../lib/data-sources";
import { CodeText } from "./CodeText";
import { CheckIcon, WarningIcon } from "./icons";

function StatusBadge({ status }: { status: "live" | "not-integrated" }) {
  if (status === "live") {
    return (
      <span className="chip chip--clear">
        <CheckIcon className="h-4 w-4 shrink-0" />
        Naudojama ataskaitose
      </span>
    );
  }
  return (
    <span className="chip">
      <WarningIcon className="h-4 w-4 shrink-0" />
      Neintegruota
    </span>
  );
}

// A spec sheet: every registry as one ruled row. On wide screens the facts sit
// in columns (name, code, coverage, update, status); on a phone each row
// restacks as a labelled block, the name and its status first.
export function DataSourcesPage() {
  return (
    <main id="main" className="container grid gap-16 pt-16 pb-24 md:pt-24">
      <div className="grid gap-6 md:grid-cols-12 md:items-end md:gap-8">
        <h1 className="text-display md:col-span-6">Duomenų šaltiniai</h1>
        <p className="max-w-[60ch] text-lg text-ink-2 md:col-span-6">
          Reginfo.lt ataskaitos surenkamos iš viešų Lietuvos valstybės registrų ir
          informacinių sistemų. Čia surašyti visi šaltiniai, ką jie apima ir kaip
          dažnai tikrinami: atvirai, kad žinotumėte, iš kur kilo kiekvienas skaičius.
        </p>
      </div>

      <div>
        <div
          aria-hidden="true"
          className="hidden grid-cols-[minmax(0,4fr)_minmax(0,5fr)_minmax(0,3fr)_minmax(0,3fr)] gap-8 border-b border-ink pb-3 text-sm font-medium text-muted lg:grid"
        >
          <span>Šaltinis</span>
          <span>Apima</span>
          <span>Atnaujinimas</span>
          <span>Būsena</span>
        </div>

        <ul className="spec lg:border-t-0">
          {DATA_SOURCES.map((source) => (
            <li
              key={source.name}
              className="grid grid-cols-1 gap-4 py-6 lg:grid-cols-[minmax(0,4fr)_minmax(0,5fr)_minmax(0,3fr)_minmax(0,3fr)] lg:gap-8"
            >
              <div className="grid min-w-0 content-start gap-1">
                <h2 className="max-w-none text-lg leading-snug">{source.name}</h2>
                <p className="text-sm text-ink-2">{source.publisher}</p>
                <p className="code text-sm wrap-anywhere text-ink-2">
                  <CodeText value={source.api} />
                </p>
                <a href={source.url} target="_blank" rel="noreferrer" className="link mt-1 w-fit text-sm">
                  Oficiali svetainė
                </a>
              </div>

              <div className="grid min-w-0 content-start gap-3">
                <p className="text-md text-ink">
                  <span className="text-sm text-muted lg:hidden">Apima: </span>
                  {source.coverage}
                </p>
                {source.caveat ? (
                  <p className="flex gap-3 text-sm text-ink-2">
                    <WarningIcon className="mt-0.5 h-5 w-5 shrink-0 text-ink" />
                    {source.caveat}
                  </p>
                ) : null}
              </div>

              <p className="text-sm text-ink-2">
                <span className="text-muted lg:hidden">Atnaujinimas: </span>
                {source.updateFrequency}
              </p>

              <div>
                <StatusBadge status={source.status} />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
