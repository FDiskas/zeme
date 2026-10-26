// Infostatyba's public project page (every document of one construction
// project, from design to completion) is keyed by a random uuid that the open
// data (OSP infostatyba_duomenys) does not carry, and no URL takes a document
// or project number instead. The one way from a record to its page is the
// site's own search form (JSF/PrimeFaces): open a session, post the
// building's address and the project's name, read the uuid off the result
// row. Opening a session is slow (the page renders the whole register, ~8 s),
// so this runs only when a reader follows the link, the session is reused,
// and every answer is cached. Anything unexpected falls back to the search page.

const BASE = "https://infostatyba.planuojustatau.lt/eInfostatyba-external/projectObject";
export const INFOSTATYBA_SEARCH_URL = `${BASE}/projectObjectSearch`;
const projectPageUrl = (uuid: string) => `${BASE}/projectObjectMain?uuid=${uuid}`;

const USER_AGENT = "Mozilla/5.0 (compatible; reginfo.lt)";
const SESSION_TTL_MS = 10 * 60 * 1000;
const ANSWER_TTL_MS = 24 * 60 * 60 * 1000;
// The search matches substrings; a name prefix is enough to tell projects at
// one address apart, and survives the open data's truncated names.
const NAME_PREFIX = 70;

type Session = {
  cookie: string;
  viewState: string;
  addressField: string;
  nameField: string;
  button: string;
  execute: string;
  openedAt: number;
};

let session: Promise<Session> | null = null;
const answers = new Map<string, { url: string; at: number }>();

const normalise = (text: string) => text.replace(/\s+/g, " ").trim();
const decode = (text: string) =>
  text.replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'");

// The field ids (j_idt…) are generated per deploy, so they are found from the
// labels every time a session opens.
function fieldFor(html: string, label: string): string {
  const match = html.match(new RegExp(`for="([^"]+)"[^>]*>\\s*${label}`));
  if (!match) throw new Error(`Infostatyba search form: no field "${label}"`);
  return match[1];
}

async function openSession(): Promise<Session> {
  const response = await fetch(INFOSTATYBA_SEARCH_URL, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(20_000),
  });
  const html = await response.text();
  const cookie = response.headers
    .getSetCookie()
    .map((header) => header.split(";")[0])
    .find((pair) => pair.startsWith("JSESSIONID="));
  const viewState = html.match(/name="javax\.faces\.ViewState"[^>]*value="([^"]+)"/)?.[1];
  const button = html.match(/<button id="([^"]+)"[^>]*p:&quot;([^&]+searchCriteria)&quot;/);
  if (!cookie || !viewState || !button) throw new Error("Infostatyba search form: unexpected page");
  return {
    cookie,
    viewState,
    addressField: fieldFor(html, "Statinio adresas"),
    nameField: fieldFor(html, "Projekto pavadinimas"),
    button: button[1],
    execute: button[2],
    openedAt: Date.now(),
  };
}

function currentSession(): Promise<Session> {
  if (!session) {
    session = openSession();
    session.catch(() => (session = null));
  }
  return session.then((open) => {
    if (Date.now() - open.openedAt < SESSION_TTL_MS) return open;
    session = null;
    return currentSession();
  });
}

type Row = { uuid: string; title: string };

// One search; null when the answer is not a result table (an expired session).
async function search(open: Session, address: string, name: string): Promise<Row[] | null> {
  const body = new URLSearchParams({
    "javax.faces.partial.ajax": "true",
    "javax.faces.source": open.button,
    "javax.faces.partial.execute": open.execute,
    "javax.faces.partial.render": "projectObjectSearchFormID",
    [open.button]: open.button,
    projectObjectSearchFormID: "projectObjectSearchFormID",
    [open.addressField]: address,
    [open.nameField]: name,
    "javax.faces.ViewState": open.viewState,
  });
  const response = await fetch(INFOSTATYBA_SEARCH_URL, {
    method: "POST",
    headers: {
      "User-Agent": USER_AGENT,
      Cookie: open.cookie,
      "Faces-Request": "partial/ajax",
      "X-Requested-With": "XMLHttpRequest",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    },
    body,
    signal: AbortSignal.timeout(15_000),
  });
  const xml = await response.text();
  if (!xml.includes("<partial-response") || !xml.includes("rowCount:")) return null;
  return [...xml.matchAll(/<tr data-ri="\d+".*?<\/tr>/gs)].flatMap((row) => {
    const link = row[0].match(/title="([^"]*)"[^>]*uuid=([A-F0-9]{32})|uuid=([A-F0-9]{32})[^>]*title="([^"]*)"/);
    if (!link) return [];
    return [{ uuid: link[2] ?? link[3], title: normalise(decode(link[1] ?? link[4] ?? "")) }];
  });
}

const answerKey = (address: string, projectName: string) =>
  `${normalise(address)}|${normalise(projectName).slice(0, NAME_PREFIX)}`;

// An answer already found, so the link can go straight there.
export function cachedInfostatybaProjectUrl(address: string, projectName: string): string | undefined {
  const cached = answers.get(answerKey(address, projectName));
  return cached && Date.now() - cached.at < ANSWER_TTL_MS ? cached.url : undefined;
}

// The project page for a building document, or the search page when it
// cannot be told for certain (no match, several projects and no name to
// choose by, the site down or changed).
export async function infostatybaProjectUrl(address: string, projectName: string): Promise<string> {
  const name = normalise(projectName).slice(0, NAME_PREFIX);
  const key = answerKey(address, projectName);
  const cached = cachedInfostatybaProjectUrl(address, projectName);
  if (cached) return cached;

  let url = INFOSTATYBA_SEARCH_URL;
  try {
    let rows = await search(await currentSession(), normalise(address), name);
    if (rows === null) {
      session = null;
      rows = await search(await currentSession(), normalise(address), name);
    }
    const lowered = name.toLocaleLowerCase("lt");
    const match =
      rows && rows.length === 1
        ? rows[0]
        : rows?.find((row) => name !== "" && row.title.toLocaleLowerCase("lt").startsWith(lowered));
    if (match) url = projectPageUrl(match.uuid);
  } catch (err) {
    console.error("Infostatyba project lookup failed:", err);
    return url; // not cached: the next reader may get through
  }
  answers.set(key, { url, at: Date.now() });
  return url;
}
