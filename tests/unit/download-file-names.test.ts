import { expect, test } from "bun:test";
import {
  extractLehrberuf,
  resolveStudentDownloadFileName,
  safeFileName,
} from "../../src/lib/download";

test("extracts Lehrberuf from EFZ/EBA application subjects", () => {
  expect(extractLehrberuf("Bewerbung um eine Lehrstelle als Kaufmann EFZ")).toBe("Kaufmann EFZ");
  expect(extractLehrberuf("Bewerbung als Detailhandelsassistentin EBA")).toBe(
    "Detailhandelsassistentin EBA",
  );
  expect(extractLehrberuf("Informatiker Plattformentwicklung EFZ – August 2027")).toBe(
    "Informatiker Plattformentwicklung EFZ",
  );
  expect(extractLehrberuf("Bewerbung um eine Lehrstelle als Mediamatiker")).toBe("Mediamatiker");
  expect(extractLehrberuf("Freie Notiz ohne Berufshinweis")).toBe("");
});

test("uses the current editor name for module JSON files", () => {
  const identity = { personName: "Lea-Müller", job: "Kauffrau EFZ" };

  expect(
    safeFileName(
      resolveStudentDownloadFileName("Bewerbungsdossier-Lea-Müller.json", "/titelblatt", identity),
    ),
  ).toBe("Titelblatt-Lea-Mueller-Kauffrau-EFZ.json");
  expect(
    safeFileName(
      resolveStudentDownloadFileName(
        "Bewerbungsdossier-Lea-Müller.json",
        "/anschreiben",
        identity,
      ),
    ),
  ).toBe("Motivationsschreiben-Lea-Mueller-Kauffrau-EFZ.json");
  expect(
    safeFileName(
      resolveStudentDownloadFileName("Bewerbungsdossier-Lea-Müller.json", "/lebenslauf", identity),
    ),
  ).toBe("Lebenslauf-Lea-Mueller-Kauffrau-EFZ.json");
});

test("names individual PDFs by module and combined PDFs as Dossier", () => {
  const identity = { personName: "Tim-Gauss", job: "Informatiker EFZ" };

  expect(
    safeFileName(
      resolveStudentDownloadFileName("Titelblatt-Tim-Gauss.pdf", "/titelblatt", identity),
    ),
  ).toBe("Titelblatt-Tim-Gauss-Informatiker-EFZ.pdf");
  expect(
    safeFileName(
      resolveStudentDownloadFileName(
        "Motivationsschreiben-Tim-Gauss.pdf",
        "/anschreiben",
        identity,
      ),
    ),
  ).toBe("Motivationsschreiben-Tim-Gauss-Informatiker-EFZ.pdf");
  expect(
    safeFileName(
      resolveStudentDownloadFileName("Lebenslauf-Tim-Gauss.pdf", "/lebenslauf", identity),
    ),
  ).toBe("Lebenslauf-Tim-Gauss-Informatiker-EFZ.pdf");
  expect(
    safeFileName(
      resolveStudentDownloadFileName("Bewerbungsdossier-Tim-Gauss.pdf", "/lebenslauf", identity),
    ),
  ).toBe("Dossier-Tim-Gauss-Informatiker-EFZ.pdf");
});

test("falls back without throwing when job or name are missing", () => {
  expect(resolveStudentDownloadFileName("Bewerbungsdossier.json", "/titelblatt", {})).toBe(
    "Titelblatt.json",
  );
  expect(resolveStudentDownloadFileName("Bewerbungsdossier.json", "/anschreiben", {})).toBe(
    "Motivationsschreiben.json",
  );
  expect(resolveStudentDownloadFileName("Bewerbungsdossier.json", "/lebenslauf", {})).toBe(
    "Lebenslauf.json",
  );
  expect(resolveStudentDownloadFileName("Bewerbungsdossier.pdf", "/lebenslauf", {})).toBe(
    "Dossier.pdf",
  );
});
