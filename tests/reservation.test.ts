import { describe, expect, it } from "vitest";
import {
  validateReservationInput,
  round2,
  mapRpcError,
} from "@/lib/utils/reservation-validation";

describe("validateReservationInput", () => {
  const validInput = {
    invoiceNumber: "",
    fbName: "",
    customerName: "Maria Santos",
    customerAddress: "123 Main St",
    phone: "+63 912 345 6789",
    itemName: "South Sea Pearl",
    itemCode: "SSP-001",
    category: "Pearls",
    quantity: 2,
    amount: 1000,
    discount: 100,
    shippingFee: 250,
    downpayment: 500,
    downpaymentMethod: "GCash",
    type: "regular" as const,
  };

  it("passes for valid input", () => {
    expect(validateReservationInput(validInput)).toBeNull();
  });

  it("fails when customer name is missing", () => {
    expect(validateReservationInput({ ...validInput, customerName: "" })).toBe("Customer name is required.");
    expect(validateReservationInput({ ...validInput, customerName: "   " })).toBe("Customer name is required.");
  });

  it("fails when item name is missing", () => {
    expect(validateReservationInput({ ...validInput, itemName: "" })).toBe("Item name is required.");
  });

  it("fails when item name has no alphanumeric characters", () => {
    expect(validateReservationInput({ ...validInput, itemName: "!@#$%" })).toBe(
      "Item name must contain at least one letter or number."
    );
  });

  it("fails when item name contains unsafe characters", () => {
    expect(validateReservationInput({ ...validInput, itemName: "Item<script>" })).toBe(
      "Item name cannot contain <, >, {, }, or backslash characters."
    );
  });

  it("fails when item code contains unsafe characters", () => {
    expect(validateReservationInput({ ...validInput, itemCode: "CODE{1}" })).toBe(
      "Item code cannot contain <, >, {, }, or backslash characters."
    );
  });

  it("fails when quantity is less than 1", () => {
    expect(validateReservationInput({ ...validInput, quantity: 0 })).toBe("Quantity must be at least 1.");
    expect(validateReservationInput({ ...validInput, quantity: -1 })).toBe("Quantity must be at least 1.");
    expect(validateReservationInput({ ...validInput, quantity: NaN })).toBe("Quantity must be at least 1.");
  });

  it("fails when amount is not positive", () => {
    expect(validateReservationInput({ ...validInput, amount: 0 })).toBe("Amount must be greater than zero.");
    expect(validateReservationInput({ ...validInput, amount: -100 })).toBe("Amount must be greater than zero.");
  });

  it("fails when discount is negative", () => {
    expect(validateReservationInput({ ...validInput, discount: -50 })).toBe("Discount cannot be negative.");
  });

  it("fails when discount equals or exceeds amount", () => {
    expect(validateReservationInput({ ...validInput, discount: 1000 })).toBe(
      "Discount cannot be equal to or exceed the amount."
    );
    expect(validateReservationInput({ ...validInput, discount: 1500 })).toBe(
      "Discount cannot be equal to or exceed the amount."
    );
  });

  it("fails when shipping fee is negative", () => {
    expect(validateReservationInput({ ...validInput, shippingFee: -10 })).toBe("Shipping fee cannot be negative.");
  });

  it("fails when downpayment is negative", () => {
    expect(validateReservationInput({ ...validInput, downpayment: -10 })).toBe("Downpayment cannot be negative.");
  });

  it("fails when downpayment exceeds the total including shipping", () => {
    expect(validateReservationInput({ ...validInput, downpayment: 1151 })).toBe(
      "Downpayment cannot exceed the total amount."
    );
  });

  it("passes when downpayment equals net amount", () => {
    expect(validateReservationInput({ ...validInput, downpayment: 900 })).toBeNull();
  });

  it("passes when discount is zero", () => {
    expect(validateReservationInput({ ...validInput, discount: 0 })).toBeNull();
  });

  it("passes when shipping fee is zero", () => {
    expect(validateReservationInput({ ...validInput, shippingFee: 0 })).toBeNull();
  });

  it("passes when downpayment is zero", () => {
    expect(validateReservationInput({ ...validInput, downpayment: 0 })).toBeNull();
  });

  it("passes for all valid reservation types", () => {
    expect(validateReservationInput({ ...validInput, type: "regular" })).toBeNull();
    expect(validateReservationInput({ ...validInput, type: "pasabuy" })).toBeNull();
    expect(validateReservationInput({ ...validInput, type: "cod" })).toBeNull();
  });

  it("passes for valid multi-item input", () => {
    const multiItemInput = {
      ...validInput,
      items: [
        { itemName: "Pearl Ring", itemCode: "PR-01", category: "Ring", quantity: 2, unitPrice: 300 },
        { itemName: "Moissanite Earring", itemCode: "ME-02", category: "Earring", quantity: 1, unitPrice: 400 },
      ],
    };
    expect(validateReservationInput(multiItemInput)).toBeNull();
  });

  it("fails when any multi-item line item is invalid", () => {
    const invalidMultiItem = {
      ...validInput,
      items: [
        { itemName: "Pearl Ring", quantity: 1, unitPrice: 500 },
        { itemName: "", quantity: 1, unitPrice: 500 },
      ],
    };
    expect(validateReservationInput(invalidMultiItem)).toBe("Item name is required.");

    const invalidQtyMultiItem = {
      ...validInput,
      items: [
        { itemName: "Pearl Ring", quantity: 1, unitPrice: 500 },
        { itemName: "Earring", quantity: 0, unitPrice: 500 },
      ],
    };
    expect(validateReservationInput(invalidQtyMultiItem)).toBe("Quantity must be at least 1.");

    const invalidPriceMultiItem = {
      ...validInput,
      items: [
        { itemName: "Pearl Ring", quantity: 1, unitPrice: 500 },
        { itemName: "Earring", quantity: 1, unitPrice: -10 },
      ],
    };
    expect(validateReservationInput(invalidPriceMultiItem)).toBe("Price cannot be negative.");
  });
});

describe("round2", () => {
  it("rounds to 2 decimal places", () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(1.004)).toBe(1.00);
    expect(round2(1000.00)).toBe(1000.00);
    expect(round2(123.456)).toBe(123.46);
    expect(round2(0.001)).toBe(0.00);
  });

  it("handles negative numbers (JS Math.round behavior)", () => {
    // JavaScript Math.round rounds halfway cases away from zero for positive,
    // but towards zero for negative. So -1.005 -> -1, -1.004 -> -1
    expect(round2(-1.005)).toBe(-1);
    expect(round2(-1.004)).toBe(-1);
    expect(round2(-1.015)).toBe(-1.01);
    expect(round2(-1.014)).toBe(-1.01);
  });
});

describe("mapRpcError", () => {
  it("maps validation errors to user-friendly messages", () => {
    // RPC errors include P0001 error code
    expect(mapRpcError(new Error('P0001: Customer name is required'))).toBe("Customer name is required.");
    expect(mapRpcError(new Error('P0001: Item name is required'))).toBe("Item name is required.");
    expect(mapRpcError(new Error('P0001: Quantity must be at least 1'))).toBe("Quantity must be at least 1.");
    expect(mapRpcError(new Error('P0001: Price cannot be negative'))).toBe("Price cannot be negative.");
    expect(mapRpcError(new Error('P0001: Discount cannot be negative'))).toBe("Discount cannot be negative.");
    expect(mapRpcError(new Error('P0001: Discount cannot exceed the subtotal'))).toBe(
      "Discount cannot exceed the subtotal."
    );
    expect(mapRpcError(new Error('P0001: Shipping fee cannot be negative'))).toBe("Shipping fee cannot be negative.");
    expect(mapRpcError(new Error('P0001: Downpayment cannot be negative'))).toBe("Downpayment cannot be negative.");
    expect(mapRpcError(new Error('P0001: Downpayment cannot exceed the total amount'))).toBe(
      "Downpayment cannot exceed the total amount."
    );
    expect(mapRpcError(new Error('P0001: Invalid reservation type'))).toBe("Invalid reservation type.");
  });

  it("maps unique constraint errors", () => {
    expect(mapRpcError(new Error("duplicate key value violates unique constraint orders_order_number_key"))).toBe(
      "Invoice number is already in use. Please try again."
    );
    expect(mapRpcError(new Error("duplicate key value violates unique constraint customers_name_key"))).toBe(
      "A customer with this name already exists."
    );
    expect(mapRpcError(new Error("duplicate key value violates unique constraint products_sku_key"))).toBe(
      "An item with this code already exists."
    );
  });

  it("maps authorization errors", () => {
    expect(mapRpcError(new Error("Not authorized to create reservations"))).toBe(
      "You are not authorized to create reservations."
    );
  });

  it("maps foreign key errors", () => {
    expect(mapRpcError(new Error("foreign key constraint violated"))).toBe("Referenced record not found.");
  });

  it("returns generic message for unknown errors", () => {
    expect(mapRpcError(new Error("Some random error"))).toBe("Could not save the reservation.");
    expect(mapRpcError(null)).toBe("Could not save the reservation.");
    expect(mapRpcError(undefined)).toBe("Could not save the reservation.");
  });
});
