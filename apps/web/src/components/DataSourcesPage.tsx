import { DATA_SOURCES } from "../lib/data-sources";
import { CheckIcon, WarningIcon } from "./icons";

function StatusBadge({ status }: { status: "live" | "not-integrated" }) {
  if (status === "live") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-forest-50 px-3 py-1 text-base font-semibold text-forest-700">
        <CheckIcon className="h-4 w-4" />
        Naudojama ataskaitose
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-base font-semibold text-amber-800">
      <WarningIcon className="h-4 w-4" />
      Neintegruota
    </span>
  );
}

export function DataSourcesPage() {
  return (
    <main className="mx-auto grid w-full max-w-shell grid-cols-[minmax(0,1fr)] gap-8 px-4 py-10 md:px-8">
      <div className="grid gap-3">
        <h1 className="font-display text-3xl font-bold tracking-tight text-mist-900 md:text-4xl">
          Duomenų šaltiniai
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-mist-700">
          Reginfo.lt ataskaitos surenkamos iš viešų Lietuvos valstybės registrų ir
          informacinių sistemų. Čia surašyti visi šaltiniai, ką jie apima ir kaip
          dažnai tikrinami: atvirai, kad žinotumėte, iš kur kilo kiekvienas skaičius.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {DATA_SOURCES.map((source) => (
          <div
            key={source.name}
            className="grid gap-3 rounded-2xl border border-mist-200 bg-white p-5 md:p-6"
          >
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
              <div className="min-w-0">
                <h2 className="text-xl font-semibold text-mist-900">{source.name}</h2>
                <p className="text-base text-mist-600">{source.publisher}</p>
              </div>
              <StatusBadge status={source.status} />
            </div>

            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-base text-mist-600">Apima</dt>
                <dd className="text-base text-mist-800">{source.coverage}</dd>
              </div>
              <div>
                <dt className="text-base text-mist-600">Atnaujinimas</dt>
                <dd className="text-base text-mist-800">{source.updateFrequency}</dd>
              </div>
            </dl>

            {source.caveat ? (
              <p className="flex gap-2.5 text-base text-amber-900">
                <WarningIcon className="mt-1 h-5 w-5 shrink-0 text-amber-700" />
                {source.caveat}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-base text-mist-600">
              <span className="min-w-0 break-all">{source.api}</span>
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-sm font-semibold text-forest-700 underline decoration-forest-300 underline-offset-4 transition-colors hover:text-forest-900 hover:decoration-forest-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600"
              >
                Oficiali svetainė
              </a>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
