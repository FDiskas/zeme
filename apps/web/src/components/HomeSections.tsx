import { useEffect, useRef, useState } from "react";
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

// On a phone the whole page shrinks past reading, so the first step shows
// the map half of the same capture instead.
const PAGE_PHONE: Capture = {
  ...PAGE,
  src: "/screens/report-map-phone.jpg",
  width: 1112,
  height: 1296,
  ratio: "1112 / 1296",
  alt: "Žemėlapis su oranžine linija apvestu sklypu Vilniuje, Tilto g. 2A, pastatais ir gretimais sklypais.",
};

const ORTHO: Capture = {
  id: "ortofoto",
  src: "/screens/report-ortho-phone.jpg",
  width: 780,
  height: 1080,
  ratio: "780 / 1080",
  title: "Ortofoto ir senesnės nuotraukos",
  line: "Perjunkite žemėlapį į ortofoto ir slinkite per metus nuo 1995-ųjų.",
  alt: "Sklypas telefone ant 2015 m. ortofoto nuotraukos, virš jo metų slankiklis.",
};

const FLAGS: Capture = {
  id: "apribojimai",
  src: "/screens/report-flags.jpg",
  width: 1056,
  height: 780,
  ratio: "1056 / 780",
  title: "Ką verta patikrinti",
  line: "Saugomos teritorijos, kultūros paveldas, tarša, potvyniai: kas rasta, rodoma pirmiausia.",
  alt: "Patikrų sąrašas: kultūros paveldas Rasta, nusikalstamumas Daugiau nei aplink, specialiosios sąlygos Tikrinti atskirai, saugomos teritorijos, tarša ir potvyniai Nerasta.",
};

const DETAIL: Capture = {
  id: "detales",
  src: "/screens/report-detail.jpg",
  width: 1056,
  height: 842,
  ratio: "1056 / 842",
  title: "Detalės su šaltiniu",
  line: "Kiekvieną įrašą galima atverti ir pamatyti, iš kurio registro jis atėjo.",
  alt: "Atvertas kultūros paveldo skydelis: šeši įrašai, kiekvienas su pavadinimu ir apsaugos statusu.",
};

/** A capture in its frame, for the tour's unpinned layout under 60rem. */
function CaptureFrame({ capture, className }: { capture: Capture; className: string }) {
  return (
    <div
      className={`frame shadow-card ${className}`}
      data-slot={`report-${capture.id}`}
      data-kind="product"
      data-alt={capture.alt}
      style={{ aspectRatio: capture.ratio }}
    >
      <img src={capture.src} width={capture.width} height={capture.height} alt={capture.alt} loading="lazy" />
    </div>
  );
}

// The tour runs in the order a reader meets the report: the boundary on the
// map, the checks, one opened panel, then the older photographs.
const TOUR = [PAGE, FLAGS, DETAIL, ORTHO];

/** Pinned: the report's screens held in one sticky frame on seven columns
 *  while four short panels scroll past on the other side; the panel crossing
 *  the middle of the screen sets the picture. Under 60rem it unpins and each
 *  panel carries its own capture beneath its words. */
export function ReportTour() {
  const [active, setActive] = useState(0);
  const panels = useRef<(HTMLElement | null)[]>([]);

  // The active panel is the last one whose top has passed the middle of the
  // screen, read from positions rather than from one crossing, so a page
  // opened or reloaded halfway down the run shows the right picture too. The
  // observer only says when a top crosses the middle.
  useEffect(() => {
    const update = () => {
      const middle = window.innerHeight / 2;
      let next = 0;
      panels.current.forEach((panel, index) => {
        if (panel && panel.getBoundingClientRect().top < middle) next = index;
      });
      setActive(next);
    };
    const observer = new IntersectionObserver(update, { rootMargin: "0px 0px -50% 0px" });
    for (const panel of panels.current) if (panel) observer.observe(panel);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="ataskaita" className="scroll-mt-(--nav-clear) border-y border-rule bg-paper-2 py-(--section-gap-s)">
      <div className="container grid gap-(--space-2xl)">
        <div className="grid gap-5 md:grid-cols-12 md:items-end md:gap-8">
          <h2 className="md:col-span-7">Taip atrodo Tilto g. 2A ataskaita</h2>
          <p className="lead text-ink-2 md:col-span-5">Ribos, faktai ir apribojimai vienoje vietoje, prieš perkant sklypą.</p>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-(--space-2xl) lg:grid-cols-12 lg:gap-x-(--gap-columns) lg:gap-y-0">
          <div className="hidden lg:col-span-7 lg:block">
            <div className="sticky top-[calc(var(--nav-clear)+var(--space-xl))] h-[calc(100svh-var(--nav-clear)-2*var(--space-xl))]">
              {TOUR.map((capture, index) => (
                <div
                  key={capture.id}
                  aria-hidden={index !== active}
                  className="absolute inset-0 flex items-center justify-center transition-opacity duration-(--dur-long) ease-(--ease-out)"
                  style={{ opacity: index === active ? 1 : 0 }}
                >
                  <img
                    src={capture.src}
                    width={capture.width}
                    height={capture.height}
                    alt={capture.alt}
                    loading="lazy"
                    className="h-auto max-h-full w-auto max-w-full rounded-card border border-rule shadow-card"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* The run ends 15svh past its last panel, so the stage holds until the
              last panel has crossed the middle of the screen. */}
          <div className="grid gap-(--space-2xl) lg:col-span-4 lg:col-start-9 lg:gap-0 lg:pb-[15svh]">
            {TOUR.map((capture, index) => (
              <article
                key={capture.id}
                id={capture.id}
                ref={(element) => {
                  panels.current[index] = element;
                }}
                className="grid scroll-mt-(--nav-clear) content-center gap-6 lg:min-h-[70svh]"
              >
                {/* The panel on the picture reads in ink with an ink rule; the
                    others step back to muted until they reach the middle. */}
                <div
                  className={`grid gap-4 border-l-2 pl-6 transition-colors duration-(--dur-short) ${
                    index === active ? "border-ink text-ink-2" : "border-edge text-muted max-lg:border-ink max-lg:text-ink-2"
                  }`}
                >
                  <h3 className={`text-2xl ${index === active ? "text-ink" : "max-lg:text-ink"}`}>{capture.title}</h3>
                  <p className="text-lg">{capture.line}</p>
                  {capture === DETAIL ? (
                    <Link to={EXAMPLE_PARCEL} className="btn btn--secondary mt-2 w-fit">
                      Atverti pavyzdinę ataskaitą
                    </Link>
                  ) : null}
                </div>
                <CaptureFrame capture={capture} className={capture === PAGE ? "max-md:hidden lg:hidden" : "lg:hidden"} />
                {capture === PAGE ? <CaptureFrame capture={PAGE_PHONE} className="md:hidden" /> : null}
              </article>
            ))}
          </div>
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
            className="hidden grid-cols-[minmax(0,5fr)_minmax(0,4fr)_minmax(0,3fr)] gap-8 border-b border-edge pb-3 text-sm font-medium text-muted md:grid"
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

/** Close: the other way in, the explore map, on a soft terracotta field. */
export function ExploreClose() {
  return (
    <section className="border-y border-rule bg-accent-soft text-ink">
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
