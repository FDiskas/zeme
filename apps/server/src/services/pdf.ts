import puppeteer from "puppeteer";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ParcelReport } from "@zeme/shared";
import { env } from "../env";

export async function renderReportPdf(report: ParcelReport): Promise<string | undefined> {
  // Keep local development fast: if Chromium is unavailable, the app still returns JSON.
  if (env.DISABLE_PDF) {
    return undefined;
  }

  const outDir = join(process.cwd(), "generated", "pdf");
  await mkdir(outDir, { recursive: true });

  const safeId = report.cadastralRegNo.replace(/[^a-zA-Z0-9-_.]/g, "_");
  const output = join(outDir, `${safeId}.pdf`);

  try {
    const browser = await puppeteer.launch({ headless: true });
    try {
      const page = await browser.newPage();
      const html = `
        <html>
          <body style="font-family: Arial, sans-serif; padding: 24px;">
            <h1>Parcel Due Diligence Report</h1>
            <p><strong>Cadastral:</strong> ${report.cadastralRegNo}</p>
            <p><strong>Address:</strong> ${report.address}</p>
            <p><strong>Generated:</strong> ${report.fetchedAt}</p>
            <hr />
            <pre style="white-space: pre-wrap;">${JSON.stringify(report.reportPanels, null, 2)}</pre>
          </body>
        </html>
      `;

      await page.setContent(html, { waitUntil: "domcontentloaded" });
      const bytes = await page.pdf({ format: "A4", printBackground: true });
      await writeFile(output, bytes);

      return output;
    } finally {
      await browser.close();
    }
  } catch (err) {
    console.error("Puppeteer PDF generation failed, skipping PDF creation:", err);
    return undefined;
  }
}
