import { ExploreMap } from "./ParcelMap";

// The map takes every pixel the header and the title leave: the page is one
// screen tall and the map grows into the rest.
export function MapExplorePage() {
  return (
    <main id="main" className="container flex h-[calc(100dvh-var(--nav-clear))] flex-col gap-4 pt-4 md:pb-6">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <h1 className="text-2xl md:text-3xl">Žemėlapis</h1>
        <p className="text-md text-ink-2">
          Naršykite po visą Lietuvą ir spustelėkite bet kurį sklypą, kad
          pamatytumėte jo ataskaitą.
        </p>
      </div>

      <ExploreMap />
    </main>
  );
}
