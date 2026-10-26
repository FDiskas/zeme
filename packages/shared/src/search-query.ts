// What a search box entry is: shared by the browser, which names the kind it
// recognised as the reader types, and the server, which resolves it to a parcel.

export type SearchQuery =
  | { kind: "unique"; value: string } // 1010-0410-102, 4400-4756-6034
  | { kind: "cadastral"; value: string } // 0101/0041:0102
  | { kind: "gps"; lat: number; lng: number } // 54.68632, 25.28576
  | { kind: "lks"; lat: number; lng: number; x: number; y: number } // 582260, 6061178
  | { kind: "maps-link"; lat: number; lng: number } // google.com/maps/…@54.68,25.28
  | { kind: "maps-short-link"; url: string } // maps.app.goo.gl/…, resolved by the server
  | { kind: "link"; url: string } // any other link: listings are not read (yet)
  | { kind: "address"; text: string };

// Shown beside the field once the entry is recognised.
export const SEARCH_KIND_LABELS: Record<SearchQuery["kind"], string> = {
  unique: "Unikalus numeris",
  cadastral: "Kadastro numeris",
  gps: "GPS koordinatės",
  lks: "LKS-94 koordinatės",
  "maps-link": "Google Maps nuoroda",
  "maps-short-link": "Google Maps nuoroda",
  link: "Nuoroda",
  address: "Adresas",
};

const CADASTRAL_REG_NO_PATTERN = /^(?<area>\d{4})[\s/-]*(?<block>\d{4})[\s:/-]*(?<parcel>\d{1,6})$/;

// "0101/41:102", "0101 0041 0102" → "0101/0041:0102": block and parcel padded
// to 4 digits, as Registrų centras and BIIP store them.
export function normalizeCadastralRegNo(value: string): string | null {
  const match = value.trim().match(CADASTRAL_REG_NO_PATTERN);
  if (!match?.groups) return null;
  const { area, block, parcel } = match.groups;
  return `${area}/${block!.padStart(4, "0")}:${parcel!.padStart(4, "0")}`;
}

// "Unikalus daikto numeris": 11 or 12 digits in dash-separated groups
// (1010-0410-102, 4400-4756-6034). The dashes tell it from a cadastral number,
// which uses "/" and ":". An 11-digit one also fits the loose cadastral
// pattern, so the server tries it as a cadastral number when no object has it.
const UNIQUE_NUMBER_PATTERN = /^\s*(\d{4})-(\d{4})-(\d{3,4})\s*$/;

export function normalizeUniqueNumber(value: string): string | null {
  const match = value.match(UNIQUE_NUMBER_PATTERN);
  if (!match) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

// Lithuania with a margin, to tell coordinates from other number pairs and to
// read them in either order.
const LT_LAT: [number, number] = [53.8, 56.5];
const LT_LNG: [number, number] = [20.9, 26.9];
const LKS_X: [number, number] = [290000, 690000];
const LKS_Y: [number, number] = [5960000, 6270000];
const within = (value: number, [min, max]: [number, number]) => value >= min && value <= max;

// Two numbers: "54.68632, 25.28576", "54,68632 25,28576", "54.68632° N 25.28576° E".
function numberPair(text: string): [number, number] | null {
  const cleaned = text
    .replace(/[°NE]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const decimalPoint = cleaned.match(/^(-?\d+(?:\.\d+)?)\s*[,; ]\s*(-?\d+(?:\.\d+)?)$/);
  const decimalComma = cleaned.match(/^(-?\d+(?:,\d+)?)\s*[; ]\s*(-?\d+(?:,\d+)?)$/);
  const match = decimalPoint ?? decimalComma;
  if (!match) return null;
  return [Number(match[1]!.replace(",", ".")), Number(match[2]!.replace(",", "."))];
}

function wgsPoint([a, b]: [number, number]): { lat: number; lng: number } | null {
  if (within(a, LT_LAT) && within(b, LT_LNG)) return { lat: a, lng: b };
  if (within(b, LT_LAT) && within(a, LT_LNG)) return { lat: b, lng: a };
  return null;
}

// Coordinates out of a full Google Maps link (also the page a short link
// leads to). The place pin (!3d…!4d…) wins over the camera (@lat,lng), which
// can sit beside the place.
export function mapsLinkPoint(url: string): { lat: number; lng: number } | null {
  const decoded = decodeURIComponent(url);
  const patterns = [
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
    /[?&](?:q|query|ll|destination|center)=(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/,
    /\/maps\/(?:place|search)\/(-?\d+\.\d+)\s*,\s*\+?(-?\d+\.\d+)/,
    /@(-?\d+\.\d+),(-?\d+\.\d+)/,
  ];
  for (const pattern of patterns) {
    const match = decoded.match(pattern);
    if (match) return wgsPoint([Number(match[1]), Number(match[2])]);
  }
  return null;
}

// The place name of a Google Maps link without coordinates ("?q=Tilto+g.+2A").
function mapsLinkPlace(url: string): string | null {
  try {
    const parsed = new URL(url);
    const q = parsed.searchParams.get("q") ?? parsed.searchParams.get("query");
    if (q) return q.trim();
    const place = parsed.pathname.match(/\/maps\/(?:place|search)\/([^/]+)/);
    return place ? decodeURIComponent(place[1]!).replace(/\+/g, " ").trim() : null;
  } catch {
    return null;
  }
}

const MAPS_SHORT_HOST = /^(?:maps\.app\.goo\.gl|goo\.gl)$/;
const MAPS_HOST = /(?:^|\.)google\.[a-z.]+$/;

function parseLink(text: string): SearchQuery | null {
  const href = /^https?:\/\//i.test(text) ? text : /^[\w-]+(\.[\w-]+)+\//.test(text) ? `https://${text}` : null;
  if (!href) return null;
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (MAPS_SHORT_HOST.test(url.hostname)) return { kind: "maps-short-link", url: url.href };
  if ((MAPS_HOST.test(url.hostname) && url.pathname.startsWith("/maps")) || url.hostname.startsWith("maps.google.")) {
    const point = mapsLinkPoint(url.href);
    if (point) return { kind: "maps-link", ...point };
    const place = mapsLinkPlace(url.href);
    if (place) return { kind: "address", text: place };
  }
  return { kind: "link", url: url.href };
}

export function parseSearchQuery(input: string): SearchQuery {
  const text = input.trim();

  const link = parseLink(text);
  if (link) return link;

  // Checked before the cadastral pattern, which would read the same digits as
  // area/block/parcel.
  const unique = normalizeUniqueNumber(text);
  if (unique) return { kind: "unique", value: unique };

  const cadastral = normalizeCadastralRegNo(text);
  if (cadastral) return { kind: "cadastral", value: cadastral };

  const pair = numberPair(text);
  if (pair) {
    const gps = wgsPoint(pair);
    if (gps) return { kind: "gps", ...gps };
    const [a, b] = pair;
    const [x, y] = within(a, LKS_X) && within(b, LKS_Y) ? [a, b] : [b, a];
    if (within(x, LKS_X) && within(y, LKS_Y)) return { kind: "lks", x, y, ...lks94ToWgs84(x, y) };
  }

  return { kind: "address", text };
}

// The point a query names, in WGS-84, when it names one directly.
export function queryPoint(query: SearchQuery): { lat: number; lng: number } | null {
  return query.kind === "gps" || query.kind === "lks" || query.kind === "maps-link"
    ? { lat: query.lat, lng: query.lng }
    : null;
}

// LKS-94 (EPSG:3346) → WGS-84: inverse Transverse Mercator on GRS80, central
// meridian 24°, scale 0.9998, false easting 500 000 m. Series from Snyder,
// "Map Projections — A Working Manual", p. 63; well under a metre here.
export function lks94ToWgs84(x: number, y: number): { lat: number; lng: number } {
  const A = 6378137;
  const F = 1 / 298.257222101;
  const E2 = F * (2 - F);
  const EP2 = E2 / (1 - E2);
  const K0 = 0.9998;
  const e1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2));

  const mu = y / K0 / (A * (1 - E2 / 4 - (3 * E2 ** 2) / 64 - (5 * E2 ** 3) / 256));
  const phi1 =
    mu +
    ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) +
    ((21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) +
    ((151 * e1 ** 3) / 96) * Math.sin(6 * mu) +
    ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu);

  const sin = Math.sin(phi1);
  const cos = Math.cos(phi1);
  const c = EP2 * cos * cos;
  const t = Math.tan(phi1) ** 2;
  const n = A / Math.sqrt(1 - E2 * sin * sin);
  const r = (A * (1 - E2)) / (1 - E2 * sin * sin) ** 1.5;
  const d = (x - 500000) / (n * K0);

  const lat =
    phi1 -
    ((n * Math.tan(phi1)) / r) *
      ((d * d) / 2 -
        ((5 + 3 * t + 10 * c - 4 * c * c - 9 * EP2) * d ** 4) / 24 +
        ((61 + 90 * t + 298 * c + 45 * t * t - 252 * EP2 - 3 * c * c) * d ** 6) / 720);
  const lng =
    (24 * Math.PI) / 180 +
    (d - ((1 + 2 * t + c) * d ** 3) / 6 + ((5 - 2 * c + 28 * t - 3 * c * c + 8 * EP2 + 24 * t * t) * d ** 5) / 120) /
      cos;

  return { lat: (lat * 180) / Math.PI, lng: (lng * 180) / Math.PI };
}
