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

// Screens captured from the running app (public/screens), in the order a
// reader meets them on the report page.
const PAGE: Capture = {
  id: "zemelapis",
  src: "/screens/report-page.jpg",
  width: 2400,
  height: 1500,
  ratio: "16 / 10",
  title: "Ribos žemėlapyje",
  line: "Sklypas pažymėtas, pastatai ir gretimi sklypai šalia. Spustelėkite kaimyną, kad atvertumėte jo ataskaitą.",
  alt: "Ataskaitos puslapis: kairėje žemėlapis su oranžine linija apvestu sklypu Vilniuje, Tilto g. 2A, dešinėje sklypo kortelė.",
};

const ORTHO: Capture = {
  id: "ortofoto",
  src: "/screens/report-ortho-phone.jpg",
  width: 780,
  height: 1180,
  ratio: "780 / 1180",
  title: "Ortofoto ir senesnės nuotraukos",
  line: "Perjunkite žemėlapį į ortofoto ir slinkite per metus nuo 1995-ųjų.",
  alt: "Sklypas telefone ant 2015 m. ortofoto nuotraukos, virš jo metų slankiklis.",
};

const FLAGS: Capture = {
  id: "apribojimai",
  src: "/screens/report-flags.jpg",
  width: 1024,
  height: 818,
  ratio: "1024 / 818",
  title: "Ką verta patikrinti",
  line: "Saugomos teritorijos, kultūros paveldas, tarša ir potvyniai: Yra arba Nėra.",
  alt: "Patikrų sąrašas: kultūros paveldas Yra (6), saugomos teritorijos, tarša ir potvyniai Nėra.",
};

const DETAIL: Capture = {
  id: "detales",
  src: "/screens/report-detail.jpg",
  width: 1024,
  height: 960,
  ratio: "1024 / 960",
  title: "Detalės su šaltiniu",
  line: "Kiekvieną įrašą galima atverti ir pamatyti, iš kurio registro jis atėjo.",
  alt: "Atvertas kultūros paveldo skydelis su objektų pavadinimais, statusu ir amžiumi.",
};

/** A capture in its frame with a short caption beneath. */
function CaptureFigure({ capture, priority = false, className = "" }: { capture: Capture; priority?: boolean; className?: string }) {
  return (
    <figure id={capture.id} className={`m-0 grid scroll-mt-(--nav-clear) content-start gap-4 ${className}`}>
      <div
        className="frame shadow-card"
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
          loading={priority ? undefined : "lazy"}
        />
      </div>
      <figcaption className="grid max-w-[52ch] gap-1">
        <span className="text-lg font-medium text-ink">{capture.title}</span>
        <span className="text-md text-ink-2">{capture.line}</span>
      </figcaption>
    </figure>
  );
}

/** Showcase: the whole report page across the width, then the checklist
 *  beside the phone on the orthophoto. The desktop page is skipped on phones,
 *  where it would shrink past reading; the close-ups carry it there. */
export function ReportShowcase() {
  return (
    <section id="ataskaita" className="container scroll-mt-(--nav-clear) py-(--section-gap)">
      <div className="grid gap-16">
        <div className="grid gap-5 md:grid-cols-12 md:items-end md:gap-8">
          <h2 className="md:col-span-7">Taip atrodo Tilto g. 2A ataskaita</h2>
          <p className="lead text-ink-2 md:col-span-5">Ribos, faktai ir apribojimai vienoje vietoje, prieš perkant sklypą.</p>
        </div>

        <CaptureFigure capture={PAGE} className="max-md:hidden" />

        <div className="grid gap-16 md:grid-cols-12 md:items-start md:gap-8">
          <div className="md:col-span-7">
            <CaptureFigure capture={FLAGS} />
          </div>
          <div className="md:col-span-4 md:col-start-9">
            <CaptureFigure capture={ORTHO} />
          </div>
        </div>
      </div>
    </section>
  );
}

/** Split: an opened panel beside the way in to the full example. */
export function DetailSplit() {
  return (
    <section className="border-y border-rule bg-paper-2 py-(--section-gap-s)">
      <div className="container grid gap-12 lg:grid-cols-12 lg:items-center lg:gap-8">
        <div className="grid gap-6 lg:col-span-5">
          <h2>{DETAIL.title}</h2>
          <p className="lead text-ink-2">{DETAIL.line}</p>
          <Link to={EXAMPLE_PARCEL} className="btn btn--secondary w-fit">
            Atverti pavyzdinę ataskaitą
          </Link>
        </div>
        <figure id={DETAIL.id} className="m-0 scroll-mt-(--nav-clear) lg:col-span-6 lg:col-start-7">
          <div
            className="frame shadow-card"
            data-slot={`report-${DETAIL.id}`}
            data-kind="product"
            data-alt={DETAIL.alt}
            style={{ aspectRatio: DETAIL.ratio }}
          >
            <img src={DETAIL.src} width={DETAIL.width} height={DETAIL.height} alt={DETAIL.alt} loading="lazy" />
          </div>
        </figure>
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
    <section className="container py-(--section-gap)">
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
            className="hidden grid-cols-[minmax(0,5fr)_minmax(0,4fr)_minmax(0,3fr)] gap-8 border-b border-ink pb-3 text-sm font-medium text-muted md:grid"
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
                <span className="code text-sm wrap-anywhere text-ink-2">
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

/** Close: the other way in, the explore map, on the tangerine field. */
export function ExploreClose() {
  // Over the tangerine field the focus ring turns ink, so it still reads.
  return (
    <section className="bg-accent text-accent-ink [--color-focus:var(--color-ink)]">
      <div className="container grid gap-12 py-(--section-gap-s) lg:grid-cols-12 lg:items-center lg:gap-8">
        <div className="grid gap-6 lg:col-span-4">
          <h2>Arba raskite sklypą žemėlapyje</h2>
          <p className="text-lg">
            Naršykite po visą Lietuvą ir spustelėkite bet kurį sklypą, kad pamatytumėte jo ataskaitą.
          </p>
          <Link to="/zemelapis" className="btn btn--secondary w-fit">
            Atverti žemėlapį
          </Link>
        </div>
        <figure className="m-0 lg:col-span-7 lg:col-start-6">
          <div
            className="frame shadow-lift"
            data-slot="explore-map"
            data-kind="product"
            data-alt="Naršymo žemėlapis, priartintas iki sklypų ribų."
            style={{ aspectRatio: "1800 / 1004" }}
          >
            <img
              src="/screens/explore-map.jpg"
              width={1800}
              height={1004}
              alt="Naršymo žemėlapis su sklypų ribomis ant ortofoto nuotraukos."
              loading="lazy"
            />
          </div>
        </figure>
      </div>
    </section>
  );
}
