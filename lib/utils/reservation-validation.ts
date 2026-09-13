/**
 * Validation utilities for reservation form.
 * Shared between server actions and tests.
 */

import type { ReservationInput } from "@/types";

/** Item names/codes accept letters, digits, and common separators. */
const ALPHANUMERIC = /[a-z0-9]/i;
const UNSAFE_ITEM_CHARS = /[<>{}\\]/;

export function validateReservationInput(input: ReservationInput): string | null {
  if (!input.customerName.trim()) return "Customer name is required.";
  if (!input.itemName.trim()) return "Item name is required.";
  if (!ALPHANUMERIC.test(input.itemName)) {
    return "Item name must contain at least one letter or number.";
  }
  if (UNSAFE_ITEM_CHARS.test(input.itemName)) {
    return "Item name cannot contain <, >, {, }, or backslash characters.";
  }
  if (input.itemCode.trim()) {
    if (!ALPHANUMERIC.test(input.itemCode)) {
      return "Item code must contain at least one letter or number.";
    }
    if (UNSAFE_ITEM_CHARS.test(input.itemCode)) {
      return "Item code cannot contain <, >, {, }, or backslash characters.";
    }
  }
  if (!Number.isFinite(input.quantity) || input.quantity < 1) {
    return "Quantity must be at least 1.";
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return "Amount must be greater than zero.";
  }
  if (!Number.isFinite(input.discount) || input.discount < 0) {
    return "Discount cannot be negative.";
  }
  if (input.discount >= input.amount) {
    return "Discount cannot be equal to or exceed the amount.";
  }
  if (!Number.isFinite(input.shippingFee) || input.shippingFee < 0) {
    return "Shipping fee cannot be negative.";
  }
  if (!Number.isFinite(input.downpayment) || input.downpayment < 0) {
    return "Downpayment cannot be negative.";
  }
  if (input.downpayment > round2(input.amount + input.shippingFee - input.discount)) {
    return "Downpayment cannot exceed the total amount.";
  }
  return null;
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function mapRpcError(error: unknown): string {
  if (!error) return "Could not save the reservation.";
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String(error.message)
      : String(error);
  if (message.includes("Downpayment cannot be reduced")) {
    return "Downpayment cannot be reduced because payment history is preserved.";
  }
  if (message.includes("valid payment method is required")) {
    return "Select a payment method for the additional downpayment.";
  }
  if (message.includes("Recorded payments exceed")) {
    return "The edited reservation total cannot be lower than its recorded payments.";
  }
  if (message.includes("P0001") || message.includes("check constraint")) {
    if (message.includes("Customer name is required")) return "Customer name is required.";
    if (message.includes("Item name is required")) return "Item name is required.";
    if (message.includes("Quantity must be at least 1")) return "Quantity must be at least 1.";
    if (message.includes("Price cannot be negative")) return "Price cannot be negative.";
    if (message.includes("Discount cannot be negative")) return "Discount cannot be negative.";
    if (message.includes("Discount cannot exceed")) return "Discount cannot exceed the subtotal.";
    if (message.includes("Shipping fee cannot be negative")) return "Shipping fee cannot be negative.";
    if (message.includes("Downpayment cannot be negative")) return "Downpayment cannot be negative.";
    if (message.includes("Downpayment cannot exceed")) return "Downpayment cannot exceed the total amount.";
    if (message.includes("Invalid reservation type")) return "Invalid reservation type.";
    return message.replace(/^.*P0001:\s*/, "");
  }
  if (message.includes("duplicate key") || message.includes("unique constraint")) {
    if (message.includes("order_number")) return "Invoice number is already in use. Please try again.";
    if (message.includes("customers")) return "A customer with this name already exists.";
    if (message.includes("products")) return "An item with this code already exists.";
    return "A record with this value already exists.";
  }
  if (message.includes("Not authorized")) return "You are not authorized to create reservations.";
  if (message.includes("foreign key")) return "Referenced record not found.";
  return "Could not save the reservation.";
}
