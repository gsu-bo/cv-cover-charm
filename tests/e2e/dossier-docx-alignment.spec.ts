import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { readStoredDocxEntries } from "../../src/lib/dossier-docx-package";

const BASE_URL = "http://127.0.0.1:4173";

function paragraphContaining(xml: string, marker: string) {
  const index = xml.indexOf(marker);
  expect(index, `${marker} must exist in document.xml`).toBeGreaterThanOrEqual(0);

  let start = xml.lastIndexOf("<w:p", index);
  while (start >= 0) {
    const openEnd = xml.indexOf(">", start);
    if (openEnd >= 0 && /^<w:p(?:\s[^>]*)?>$/.test(xml.slice(start, openEnd + 1))) break;
    start = xml.lastIndexOf("<w:p", start - 1);
  }
  const end = xml.indexOf("</w:p>", index);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThanOrEqual(0);
  return xml.slice(start, end + 6);
}

async function seedAlignedDossier(page: Page) {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem(
      "titelblatt:v3",
      JSON.stringify({
        version: 3,
        template: "brief",
        data: {
          vorname: "Lea",
          nachname: "Müller",
          beruf: "Informatikerin EFZ",
          lehrbeginn: "August 2027",
          adresse: "Dorfstrasse 12",
          plzOrt: "4535 Hubersdorf",
          telefon: "+41 79 123 45 67",
          email: "lea@example.ch",
          lehrbetrieb: "Beispiel AG",
          ansprechperson: "Herr Thomas Weber",
          betriebAdresse: "Industriestrasse 8",
          ort: "Hubersdorf",
          datum: "16.09.2026",
        },
      }),
    );
    localStorage.setItem(
      "anschreiben:v1",
      JSON.stringify({
        version: 1,
        data: {
          absenderName: "Lea Müller",
          absenderAdresse: "Dorfstrasse 12",
          absenderPlzOrt: "4535 Hubersdorf",
          absenderTelefon: "+41 79 123 45 67",
          absenderEmail: "lea@example.ch",
          empfaengerFirma: "Beispiel AG",
          empfaengerName: "Herr Thomas Weber",
          empfaengerAdresse: "Industriestrasse 8",
          empfaengerPlzOrt: "4500 Solothurn",
          ort: "Hubersdorf",
          datum: "16.09.2026",
          betreff: "Bewerbung um eine Lehrstelle als Informatikerin EFZ",
          anrede: "Guten Tag Herr Weber",
          text: "LETTER-LEFT-DOCX\n\nLETTER-JUSTIFY-DOCX",
          richTextHtml:
            '<div data-align="left">LETTER-LEFT-DOCX</div><div><br></div><div data-align="justify">LETTER-JUSTIFY-DOCX</div>',
          gruss: "Freundliche Grüsse",
          unterschrift: "Lea Müller",
          showBeilagen: false,
          beilagen: [],
        },
        design: { template: "brief", font: "freundlich", colors: {} },
      }),
    );
    localStorage.setItem(
      "lebenslauf:v1",
      JSON.stringify({
        version: 6,
        data: {
          titel: "Lebenslauf",
          person: {
            vorname: "Lea",
            nachname: "Müller",
            adresse: "Dorfstrasse 12",
            plzOrt: "4535 Hubersdorf",
            telefon: "+41 79 123 45 67",
            email: "lea@example.ch",
            geburtsdatum: "14.03.2010",
            nationalitaet: "Schweiz",
            untertitel: "Schülerin, 3. Sek B",
            foto: null,
          },
          schule: [
            {
              id: "schule-docx-align",
              zeit: "2023 – heute",
              titel: "Sekundarschule",
              ort: "Hubersdorf",
              beschreibung: "CV-JUSTIFY-DOCX",
            },
          ],
          erfahrung: [],
          sprachen: [],
          hobbys: [],
          staerken: [],
          referenzen: [],
          labels: {},
          hidden: {},
        },
        design: { template: "brief", colors: {}, bgOpacity: 0.25, useElements: false },
      }),
    );
    localStorage.setItem("lebenslauf:text-align:v1", "justify");
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
}

test.describe("real DOCX body alignment parity", () => {
  test.setTimeout(120_000);

  test("letter left/justify and CV justify survive the complete DOCX export pipeline", async ({
    page,
  }) => {
    await seedAlignedDossier(page);

    const exportCard = page.getByRole("button", { name: /Gesamtdossier herunterladen/ });
    await expect(exportCard).toBeEnabled();
    await exportCard.click();

    const option = page.getByRole("radio", { name: /Bearbeitbares Dossier \(DOCX\)/ });
    await expect(option).toBeEnabled();
    await option.click();

    const button = page.getByRole("button", { name: "DOCX herunterladen" });
    const [download] = await Promise.all([page.waitForEvent("download"), button.click()]);
    const path = await download.path();
    expect(path).not.toBeNull();

    const bytes = new Uint8Array(await readFile(path!));
    const entries = readStoredDocxEntries(bytes, "Alignment-E2E");
    const documentXmlEntry = entries.find((entry) => entry.name === "word/document.xml");
    expect(documentXmlEntry).toBeTruthy();
    const xml = new TextDecoder().decode(documentXmlEntry!.bytes);

    expect(paragraphContaining(xml, "LETTER-LEFT-DOCX")).toContain('<w:jc w:val="left"/>');
    expect(paragraphContaining(xml, "LETTER-JUSTIFY-DOCX")).toContain(
      '<w:jc w:val="both"/>',
    );
    expect(paragraphContaining(xml, "CV-JUSTIFY-DOCX")).toContain('<w:jc w:val="both"/>');
  });
});
