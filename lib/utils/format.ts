export function formatCurrency(amount: number, currency = "PHP"): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency,
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function monthName(month: number): string {
  return MONTH_NAMES[Math.min(Math.max(month, 1), 12) - 1];
}

const RESERVATION_TYPE_LABELS: Record<string, string> = {
  regular: "Regular",
  pasabuy: "Pasabuy",
  cod: "COD",
};

/** Human label for an order's reservation type (regular/pasabuy/cod). */
export function formatReservationType(
  type: string | null | undefined
): string {
  if (!type) return "Regular";
  return RESERVATION_TYPE_LABELS[type] ?? type;
}
