import type { UpstreamPanel } from "./connectors";

// ---------------------------------------------------------------------------
// Registrų centras — masinis vertinimas (mass valuation).
//
// The public valuation lookup at registrucentras.lt/masvert/paieska-obj is a
// Spring form: it requires a CSRF token + session cookie obtained from the page
// itself, then returns the result as HTML (no JSON API). We fetch the page,
// extract the token, POST the search by unique object number, and scrape the
// single value table out of the response. Any failure degrades to null so the
// rest of the report still builds — we never fabricate a value.
// ---------------------------------------------------------------------------

const MASVERT_URL = "https://www.registrucentras.lt/masvert/paieska-obj";
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export interface MarketValue {
  valueEur: number;
  valuationDate: string;
  note?: string;
}

// Keep only `name=value` (before the first `;`) of each Set-Cookie, rejoined for
// the follow-up request's Cookie header.
function collectCookies(setCookies: string[]): string {
  return setCookies
    .map((c) => c.split(";")[0]?.trim())
    .filter((c): c is string => Boolean(c))
    .join("; ");
}

// The valuation table sits between the two named forms on the result page.
function parseMarketValue(html: string): MarketValue | null {
  const start = html.indexOf('id="objektoForma"');
  const end = html.indexOf('id="anketosForma"');
  const scope = start >= 0 && end > start ? html.slice(start, end) : html;

  const valueRaw = scope.match(/Daikto vertė:\s*<strong>([^<]*)<\/strong>/i)?.[1]?.trim();
  if (!valueRaw) return null;
  const valueEur = Number(valueRaw.replace(/[^0-9]/g, ""));
  if (!Number.isFinite(valueEur) || valueEur <= 0) return null;

  const valuationDate =
    scope.match(/Vertinimo data:\s*<strong>([^<]*)<\/strong>/i)?.[1]?.trim() ?? "";
  const note = scope.match(/Pastaba:\s*([^<]+)</i)?.[1]?.trim();

  return { valueEur, valuationDate, note: note || undefined };
}

// `uniqueNumber` must be the dashed form the form expects, e.g. 4400-4756-6034.
export async function fetchMarketValue(uniqueNumber: string): Promise<MarketValue | null> {
  if (!uniqueNumber) return null;
  try {
    // 1. GET the form page → CSRF token (hidden input) + session cookie.
    const pageRes = await fetch(MASVERT_URL, {
      headers: { "User-Agent": BROWSER_UA },
      signal: AbortSignal.timeout(7000),
    });
    if (!pageRes.ok) return null;

    const cookie = collectCookies(pageRes.headers.getSetCookie?.() ?? []);
    const pageHtml = await pageRes.text();
    const csrf = pageHtml.match(/name="_csrf"[^>]*value="([^"]+)"/i)?.[1];
    if (!csrf) return null;

    // 2. POST the search; reuse the session cookie so the CSRF token validates.
    const body = new URLSearchParams({
      paieska: "1",
      unikalusNr: uniqueNumber,
      stvGalioja: "G",
      _csrf: csrf,
    });
    const res = await fetch(MASVERT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": BROWSER_UA,
        Referer: MASVERT_URL,
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: body.toString(),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;

    return parseMarketValue(await res.text());
  } catch {
    return null;
  }
}

// Report panel carrying the structured value; buildSummary lifts it into the
// "Vidutinė rinkos vertė" summary fact.
export async function getMarketValuePanel(uniqueNumber: string): Promise<UpstreamPanel> {
  const base = {
    key: "rc-masvert",
    title: "Vidutinė rinkos vertė",
    source: "registrucentras.lt masinis vertinimas",
    status: "ok" as const,
  };

  const value = await fetchMarketValue(uniqueNumber);
  if (!value) {
    return {
      ...base,
      items: [],
      note: "Vidutinės rinkos vertės šiam objektui rasti nepavyko.",
    };
  }

  return {
    ...base,
    items: [
      {
        marketValueEur: value.valueEur,
        valuationDate: value.valuationDate,
        note: value.note ?? "",
      },
    ],
  };
}
