import { INFOSTATYBA_SEARCH_URL } from "./infostatyba-link";

// The page a reader sees while the Infostatyba project page is being found:
// it says what is happening, asks `lookup` for the address, then goes there.
// Without scripts, or if the lookup fails, it offers the search page. Colours
// and faces follow the web app's tokens (apps/web/src/tokens.css).
export function infostatybaWaitPage(lookup: string): string {
  const fallback = INFOSTATYBA_SEARCH_URL;
  return `<!doctype html>
<html lang="lt">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Ieškoma Infostatyboje – Reginfo.lt</title>
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<style>
  :root {
    --color-paper: oklch(96% 0.011 85);
    --color-ink: oklch(24% 0.01 60);
    --color-muted: oklch(47% 0.012 60);
    --color-rule: oklch(88% 0.013 85);
    --color-accent: oklch(55% 0.125 38);
    --font-body: "Red Hat Text", ui-sans-serif, system-ui, sans-serif;
  }
  html, body { overflow-x: clip; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 16px; background: var(--color-paper); color: var(--color-ink); font: 400 1.125rem/1.55 var(--font-body); }
  main { max-width: 32rem; display: grid; gap: 12px; justify-items: start; }
  h1 { margin: 0; font-size: 1.5625rem; font-weight: 600; line-height: 1.2; overflow-wrap: break-word; min-width: 0; }
  p { margin: 0; color: var(--color-muted); }
  .spinner { width: 28px; height: 28px; border-radius: 50%; border: 3px solid var(--color-rule); border-top-color: var(--color-accent); animation: spin 0.9s linear infinite; }
  a { color: var(--color-ink); font-weight: 500; text-underline-offset: 0.2em; }
  a:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .spinner { animation: none; } }
</style>
</head>
<body>
<main>
  <div class="spinner" aria-hidden="true"></div>
  <h1>Ieškoma statybos projekto Infostatyboje</h1>
  <p id="status" role="status">Tai užtrunka iki 10 sekundžių.</p>
  <p>Jei nieko nevyksta, <a id="fallback" href="${fallback}">atverkite Infostatybos paiešką</a> ir įrašykite pastato adresą.</p>
</main>
<script>
  fetch(${JSON.stringify(lookup)})
    .then((response) => response.json())
    .then((answer) => location.replace(answer.url))
    .catch(() => {
      document.getElementById("status").textContent = "Projekto rasti nepavyko.";
    });
</script>
</body>
</html>`;
}
