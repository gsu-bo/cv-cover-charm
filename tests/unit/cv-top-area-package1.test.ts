import { describe, expect, test } from "bun:test";
import { DEMO_CV } from "../../src/components/cv/types";
import { CANONICAL_DOSSIER_CHROME_OPTIONS } from "../../src/lib/dossier-chrome";
import { cvBodyData } from "../../src/lib/dossier-body-contact";

const person = {
  ...DEMO_CV.person,
  vorname: "Lea",
  nachname: "Müller",
  untertitel: "hugubugu",
  adresse: "Dorfstrasse 12",
  plzOrt: "4535 Hubersdorf",
  telefon: "+41 79 000 00 00",
  email: "lea@example.ch",
};

const data = { ...DEMO_CV, person };

describe("Package 1 CV top-area semantics", () => {
  test("a contact header containing the name never suppresses the CV body identity", () => {
    const result = cvBodyData(data, {
      ...CANONICAL_DOSSIER_CHROME_OPTIONS,
      headerMode: "contact",
      headerShowName: true,
      headerShowAddress: true,
      headerShowPhone: true,
      headerShowEmail: true,
    });

    expect(result.person.vorname).toBe("Lea");
    expect(result.person.nachname).toBe("Müller");
    expect(result.person.untertitel).toBe("hugubugu");
    expect(result.person.adresse).toBe("");
    expect(result.person.plzOrt).toBe("");
    expect(result.person.telefon).toBe("");
    expect(result.person.email).toBe("");
  });

  test("body identity is unchanged whether the contact header shows its own name or not", () => {
    for (const headerShowName of [false, true]) {
      const result = cvBodyData(data, {
        ...CANONICAL_DOSSIER_CHROME_OPTIONS,
        headerMode: "contact",
        headerShowName,
        headerShowAddress: false,
        headerShowPhone: false,
        headerShowEmail: false,
      });
      expect(`${result.person.vorname} ${result.person.nachname}`).toBe("Lea Müller");
      expect(result.person.untertitel).toBe("hugubugu");
    }
  });

  test("an empty line-under-name does not affect the body name", () => {
    const result = cvBodyData(
      { ...data, person: { ...person, untertitel: "" } },
      {
        ...CANONICAL_DOSSIER_CHROME_OPTIONS,
        headerMode: "contact",
        headerShowName: true,
      },
    );
    expect(result.person.vorname).toBe("Lea");
    expect(result.person.nachname).toBe("Müller");
    expect(result.person.untertitel).toBe("");
  });
});
