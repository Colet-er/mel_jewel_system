/**
 * The four order types. Pasabuy COD is its own type (not a flag on COD), so an
 * order is exactly one of these.
 */
export const RESERVATION_TYPES = ["regular", "cod", "pasabuy", "pasabuy_cod"] as const;

export type ReservationTypeValue = (typeof RESERVATION_TYPES)[number];

/** Label shown in the UI, lists, and CSV exports. */
export const RESERVATION_TYPE_LABELS: Record<ReservationTypeValue, string> = {
  regular: "Regular",
  cod: "Regular COD",
  pasabuy: "Pasabuy",
  pasabuy_cod: "Pasabuy COD",
};

/** Regular COD and Pasabuy COD both collect the COD money. */
export function isCodType(type: string | null | undefined): boolean {
  return type === "cod" || type === "pasabuy_cod";
}

/** Pasabuy and Pasabuy COD are both Pasabuy orders. */
export function isPasabuyType(type: string | null | undefined): boolean {
  return type === "pasabuy" || type === "pasabuy_cod";
}

/** Form choices in the order the staff pick them. */
export const RESERVATION_FORM_TYPES = ["Regular", "Regular COD", "Pasabuy", "Pasabuy COD"] as const;

export type ReservationFormType = (typeof RESERVATION_FORM_TYPES)[number];

const FORM_TO_DB: Record<ReservationFormType, ReservationTypeValue> = {
  Regular: "regular",
  "Regular COD": "cod",
  Pasabuy: "pasabuy",
  "Pasabuy COD": "pasabuy_cod",
};

/** Form choice to the stored order type. */
export function formTypeToDb(type: ReservationFormType): ReservationTypeValue {
  return FORM_TO_DB[type];
}

/** Stored order type to the form choice (unknown or empty becomes Regular). */
export function dbTypeToForm(type: string | null | undefined): ReservationFormType {
  const match = RESERVATION_FORM_TYPES.find((option) => FORM_TO_DB[option] === type);
  return match ?? "Regular";
}
