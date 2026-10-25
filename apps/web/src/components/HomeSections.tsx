import { Link } from "react-router-dom";
import { DATA_SOURCES } from "../lib/data-sources";
import { CodeText } from "./CodeText";

// The parcel the captures below were taken from, so "see an example" opens
// exactly the report the pictures show.
const EXAMPLE_PARCEL = "/parcel/0101%2F0041%3A0102";

type Capture = {
  id: string;
  src: string;
  width: number;
  height: number;
  ratio: string;
  title: string;
  line: string;
  alt: string;
};

// Screens captured from the running app (public/screens), shown in the order a
// reader meets them on the report page.
const CAPTURES: Capture[] = [
  {
    id: "zemelapis",
    src: "/screens/report-map.jpg",
    width: 1200,
    height: 1200,
    ratio: "1 / 1",
    title: "Ribos žemėlapyje",
    line: "Sklypas pažymėtas, pastatai ir gretimi sklypai šalia. Spustelėkite kaimyną, kad atvertumėte jo ataskaitą.",
    alt: "Ataskaitos žemėlapis: sklypas Vilniuje, Tilto g. 2A, pažymėtas rūdžių spalva, viduje keturi pastatai.",
  },
  {
    id: "faktai",
    src: "/screens/report-facts.jpg",
    width: 928,
    height: 1160,
    ratio: "928 / 1160",
    title: "Svarbiausi faktai",
    line: "Adresas, kadastrinis ir unikalus numeriai, plotas, paskirtis, pastatai, atstumas iki mokyklos.",
    alt: "Ataskaitos santrauka: adresas, kadastrinis numeris 0101/0041:0102, plotas 0,181 ha, paskirtis Kita.",
  },
  {
    id: "apribojimai",
    src: "/screens/report-flags.jpg",
    width: 920,
    height: 904,
    ratio: "920 / 904",
    title: "Ką verta patikrinti",
    line: "Saugomos teritorijos, kultūros paveldas, tarša ir potvyniai: Yra arba Nėra.",
    alt: "Ataskaitos patikrų sąrašas: kultūros paveldas Yra (6), saugomos teritorijos, tarša ir potvyniai Nėra.",
  },
  {
    id: "detales",
    src: "/screens/report-detail.jpg",
    width: 928,
    height: 826,
    ratio: "928 / 826",
    title: "Detalės su šaltiniu",
    line: "Kiekvieną įrašą galima atverti ir pamatyti, iš kurio registro jis atėjo.",
    alt: "Atvertas kultūros paveldo skydelis su objektų pavadinimais, statusu ir amžiumi.",
  },
];

/** Feature stack: the head held in a sticky pane while real captures scroll past. */
export function ReportStack() {
  return (
    <section id="ataskaita" className="container py-(--section-gap)">
      <div className="grid gap-16 lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-5">
          <div className="grid gap-8 lg:sticky lg:top-[calc(var(--nav-clear)+3rem)]">
            <div className="grid gap-5">
              <h2>Taip atrodo Tilto g. 2A ataskaita</h2>
              <p className="lead text-ink-2">Ribos, faktai ir apribojimai vienoje vietoje, prieš perkant sklypą.</p>
            </div>
            <ol className="spec hidden lg:block">
              {CAPTURES.map((capture, i) => (
                <li key={capture.id}>
                  <a
                    href={`#${capture.id}`}
                    className="flex items-baseline gap-5 py-3 text-md font-medium text-ink transition-colors duration-150 hover:bg-accent-soft focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus active:bg-paper-3"
                  >
                    <span className="w-6 font-display text-xl font-bold">{i + 1}</span>
                    {capture.title}
                  </a>
                </li>
              ))}
            </ol>
            <Link to={EXAMPLE_PARCEL} className="btn btn--secondary w-fit">
              Atverti pavyzdinę ataskaitą
            </Link>
          </div>
        </div>

        <div className="grid gap-24 lg:col-span-6 lg:col-start-7">
          {CAPTURES.map((capture, i) => (
            <figure key={capture.id} id={capture.id} className="m-0 grid scroll-mt-(--nav-clear) gap-6">
              <div
                className="card"
                data-slot={`report-${capture.id}`}
                data-kind="product"
                data-alt={capture.alt}
                style={{ aspectRatio: capture.ratio }}
              >
                <img
                  src={capture.src}
                  width={capture.width}
                  height={capture.height}
                  alt={capture.alt}
                  loading="lazy"
                />
              </div>
              <figcaption className="grid max-w-[52ch] gap-1">
                <span className="text-lg font-medium text-ink">
                  <span className="font-display font-bold lg:hidden">{i + 1} </span>
                  {capture.title}
                </span>
                <span className="text-md text-ink-2">{capture.line}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

// The five registries a first report leans on most: boundaries, buildings,
// protected areas, heritage, planning. The full list lives on its own page.
const KEY_SOURCES = ["biip-boundary", "grpk-buildings", "geoportal-constraints", "kvr-heritage", "asgr-regulations"];

/** Spec table: the main registries, their keepers and their codes. */
export function SourcesSpec() {
  const rows = KEY_SOURCES.map((key) => DATA_SOURCES.find((source) => source.panelKey === key)).filter(
    (source) => source !== undefined,
  );

  return (
    <section className="container pb-(--section-gap)">
      <div className="grid gap-12">
        <div className="grid gap-5 md:grid-cols-12 md:items-end md:gap-8">
          <h2 className="md:col-span-6">Duomenys iš valstybės registrų</h2>
          <p className="max-w-[44ch] text-lg text-ink-2 md:col-span-5 md:col-start-8">
            Kiekvieno įrašo šaltinis nurodytas ataskaitoje.
          </p>
        </div>

        <div>
          <div
            aria-hidden="true"
            className="hidden grid-cols-[minmax(0,5fr)_minmax(0,4fr)_minmax(0,3fr)] gap-8 border-b-2 border-ink pb-3 text-sm font-medium text-muted md:grid"
          >
            <span>Registras</span>
            <span>Tvarko</span>
            <span>Kodas</span>
          </div>
          <ul className="spec md:border-t-0">
            {rows.map((source) => (
              <li
                key={source.name}
                className="grid grid-cols-1 gap-1 py-5 md:grid-cols-[minmax(0,5fr)_minmax(0,4fr)_minmax(0,3fr)] md:items-baseline md:gap-8"
              >
                <span className="text-title font-medium leading-snug text-ink">{source.name}</span>
                <span className="text-md text-ink-2">{source.publisher}</span>
                <span className="code text-sm wrap-anywhere text-accent">
                  <CodeText value={source.api} />
                </span>
              </li>
            ))}
          </ul>
        </div>

        <Link to="/duomenu-saltiniai" className="link w-fit text-lg">
          Visi šaltiniai ({DATA_SOURCES.length})
        </Link>
      </div>
    </section>
  );
}

/** Close: the other way in, the explore map, beside a capture of it. */
export function ExploreClose() {
  return (
    <section className="border-t-2 border-ink pb-(--section-gap)">
      <div className="container grid gap-12 pt-(--section-gap-s) lg:grid-cols-12 lg:items-center lg:gap-8">
        <div className="grid gap-6 lg:col-span-4">
          <h2>Arba raskite sklypą žemėlapyje</h2>
          <p className="text-lg text-ink-2">
            Naršykite po visą Lietuvą ir spustelėkite bet kurį sklypą, kad pamatytumėte jo ataskaitą.
          </p>
          <Link to="/zemelapis" className="btn btn--secondary w-fit">
            Atverti žemėlapį
          </Link>
        </div>
        <figure className="m-0 lg:col-span-7 lg:col-start-6">
          <div
            className="card"
            data-slot="explore-map"
            data-kind="product"
            data-alt="Naršymo žemėlapis, priartintas iki sklypų ribų."
            style={{ aspectRatio: "1800 / 964" }}
          >
            <img
              src="/screens/explore-map.jpg"
              width={1800}
              height={964}
              alt="Naršymo žemėlapis Vilniuje su pažymėtomis sklypų ribomis."
              loading="lazy"
            />
          </div>
        </figure>
      </div>
    </section>
  );
}
