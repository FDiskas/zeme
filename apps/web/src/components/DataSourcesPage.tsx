import { ADAPTED, creditHead, DATA_SOURCES, type DataSource, type DataSourceStatus } from "../lib/data-sources";
import { CodeText } from "./CodeText";
import { CheckIcon, WarningIcon } from "./icons";

const IN_USE_LABEL: Record<Exclude<DataSourceStatus, "not-integrated">, string> = {
  live: "Naudojama ataskaitose",
  map: "Naudojama žemėlapyje",
  search: "Naudojama paieškai",
};

function StatusBadge({ status }: { status: DataSourceStatus }) {
  if (status !== "not-integrated") {
    return (
      <span className="chip chip--clear">
        <CheckIcon className="h-4 w-4 shrink-0" />
        {IN_USE_LABEL[status]}
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

// The credit line every source in use carries: where the data came from, the
// licence the publisher states for it (or that it states none), and how it
// was handled on the way to the page.
function Credit({ source }: { source: DataSource }) {
  const { licence } = source;
  return (
    <p className="rounded-card bg-paper-2 px-4 py-3 text-sm text-ink-2">
      Duomenų šaltinis: {creditHead(source)}.{" "}
      {licence ? (
        <>
          Duomenys platinami{" "}
          <a href={licence.url} target="_blank" rel="noreferrer" className="link font-normal">
            {licence.phrase}
          </a>{" "}
          (
          <a href={licence.statedAt} target="_blank" rel="noreferrer" className="link font-normal">
            kur nurodyta
          </a>
          ).
        </>
      ) : (
        "Šaltinis licencijos nenurodo."
      )}{" "}
      {source.licenceNote ? `${source.licenceNote} ` : null}
      {source.processing ?? ADAPTED}
    </p>
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
          informacinių sistemų. Čia surašyti visi šaltiniai, ką jie apima, kaip dažnai
          tikrinami ir pagal kokią licenciją naudojami. Duomenų turinio nekeičiame: tik
          surenkame ir parodome. Duomenys priklauso juos tvarkančioms institucijoms.
        </p>
      </div>

      <div>
        <div
          aria-hidden="true"
          className="hidden grid-cols-[minmax(0,4fr)_minmax(0,5fr)_minmax(0,3fr)_minmax(0,3fr)] gap-8 border-b border-edge pb-3 text-sm font-medium text-muted lg:grid"
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
                {source.status !== "not-integrated" ? <Credit source={source} /> : null}
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
