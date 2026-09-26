import { ExploreMap } from "./ParcelMap";

export function MapExplorePage() {
  return (
    <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-10 md:px-8">
      <div className="grid gap-3">
        <h1 className="font-display text-3xl font-bold tracking-tight text-mist-900 md:text-4xl">
          Žemėlapis
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-mist-600">
          Naršykite po visą Lietuvą ir spustelėkite bet kurį sklypą, kad
          pamatytumėte jo ataskaitą.
        </p>
      </div>

      <ExploreMap />
    </main>
  );
}
