import { DATA_SOURCES } from "../lib/data-sources";
import { CheckIcon, WarningIcon } from "./icons";

function StatusBadge({ status }: { status: "live" | "not-integrated" }) {
  if (status === "live") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-forest-50 px-3 py-1 text-sm font-semibold text-forest-700">
        <CheckIcon className="h-4 w-4" />
        Naudojama ataskaitose
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-800">
      <WarningIcon className="h-4 w-4" />
      Neintegruota
    </span>
  );
}

export function DataSourcesPage() {
  return (
    <main className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 md:px-8">
      <div className="grid gap-3">
        <h1 className="font-display text-3xl font-bold tracking-tight text-mist-900 md:text-4xl">
          Duomenų šaltiniai
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-mist-600">
          Reginfo.lt ataskaitos surenkamos iš viešų Lietuvos valstybės registrų ir
          informacinių sistemų. Čia surašyti visi šaltiniai, ką jie apima ir kaip
          dažnai tikrinami — atvirai, kad žinotumėte, iš kur kilo kiekvienas skaičius.
        </p>
      </div>

      <div className="grid gap-4">
        {DATA_SOURCES.map((source) => (
          <div
            key={source.name}
            className="grid gap-3 rounded-2xl border border-mist-200 bg-white p-6 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-mist-900">{source.name}</h2>
                <p className="text-base text-mist-500">{source.publisher}</p>
              </div>
              <StatusBadge status={source.status} />
            </div>

            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-mist-500">Apima</dt>
                <dd className="text-base text-mist-800">{source.coverage}</dd>
              </div>
              <div>
                <dt className="text-sm text-mist-500">Atnaujinimas</dt>
                <dd className="text-base text-mist-800">{source.updateFrequency}</dd>
              </div>
            </dl>

            {source.caveat ? (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-base text-amber-900">
                {source.caveat}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-mist-500">
              <span>{source.api}</span>
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-forest-700 underline decoration-forest-300 underline-offset-2 hover:text-forest-800"
              >
                Oficiali svetainė ↗
              </a>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
