import { ExploreMap } from "./ParcelMap";

// The map takes every pixel the header and the title leave: the page is one
// screen tall and the map grows into the rest.
export function MapExplorePage() {
  return (
    <main className="mx-auto flex h-[calc(100dvh-4rem)] w-full max-w-shell flex-col gap-3 px-4 pt-4 md:px-8 md:pb-6">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="font-display text-2xl font-bold tracking-tight text-mist-900 md:text-3xl">
          Žemėlapis
        </h1>
        <p className="text-lg text-mist-700">
          Naršykite po visą Lietuvą ir spustelėkite bet kurį sklypą, kad
          pamatytumėte jo ataskaitą.
        </p>
      </div>

      <ExploreMap />
    </main>
  );
}
