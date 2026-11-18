import { describe, expect, it } from "vitest";
import {
  dbTypeToForm,
  formTypeToDb,
  isCodType,
  isPasabuyType,
} from "@/lib/utils/reservation-type";

describe("reservation types", () => {
  it("maps the four form choices to the four stored types and back", () => {
    expect(formTypeToDb("Regular")).toBe("regular");
    expect(formTypeToDb("Regular COD")).toBe("cod");
    expect(formTypeToDb("Pasabuy")).toBe("pasabuy");
    expect(formTypeToDb("Pasabuy COD")).toBe("pasabuy_cod");
    expect(dbTypeToForm("pasabuy_cod")).toBe("Pasabuy COD");
    expect(dbTypeToForm("cod")).toBe("Regular COD");
    expect(dbTypeToForm(null)).toBe("Regular");
  });

  it("treats both COD types as COD and both Pasabuy types as Pasabuy", () => {
    expect(isCodType("cod")).toBe(true);
    expect(isCodType("pasabuy_cod")).toBe(true);
    expect(isCodType("pasabuy")).toBe(false);
    expect(isPasabuyType("pasabuy")).toBe(true);
    expect(isPasabuyType("pasabuy_cod")).toBe(true);
    expect(isPasabuyType("regular")).toBe(false);
  });
});
