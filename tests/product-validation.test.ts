import { describe, expect, it } from "vitest";
import { validateProductInput } from "@/lib/utils/product-validation";

describe("validateProductInput", () => {
  const validProduct = {
    name: "South Sea Pearl Necklace",
    sku: "SSP-NCK-01",
    categoryId: "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
    price: 15000,
    cost: 8000,
    stock: 5,
    isActive: true,
  };

  it("passes for valid product input", () => {
    expect(validateProductInput(validProduct)).toBeNull();
  });

  it("passes for minimal valid product input", () => {
    expect(
      validateProductInput({
        name: "Freshwater Pearl Studs",
        price: 1200,
      })
    ).toBeNull();
  });

  it("fails when product name is empty or whitespace", () => {
    expect(validateProductInput({ ...validProduct, name: "" })).toBe("Product name is required.");
    expect(validateProductInput({ ...validProduct, name: "   " })).toBe("Product name is required.");
  });

  it("fails when product name exceeds 200 characters", () => {
    expect(validateProductInput({ ...validProduct, name: "A".repeat(201) })).toBe(
      "Product name cannot exceed 200 characters."
    );
  });

  it("fails when price is negative or not a number", () => {
    expect(validateProductInput({ ...validProduct, price: -10 })).toBe("Price must be zero or greater.");
    expect(validateProductInput({ ...validProduct, price: Number.NaN })).toBe("Price must be zero or greater.");
  });

  it("fails when cost is negative or not a number", () => {
    expect(validateProductInput({ ...validProduct, cost: -50 })).toBe("Cost must be zero or greater.");
    expect(validateProductInput({ ...validProduct, cost: Number.NaN })).toBe("Cost must be zero or greater.");
  });

  it("fails when stock is negative or non-integer", () => {
    expect(validateProductInput({ ...validProduct, stock: -1 })).toBe(
      "Stock must be a non-negative whole number."
    );
    expect(validateProductInput({ ...validProduct, stock: 3.5 })).toBe(
      "Stock must be a non-negative whole number."
    );
  });

  it("fails when categoryId is invalid UUID", () => {
    expect(validateProductInput({ ...validProduct, categoryId: "invalid-uuid" })).toBe("Invalid category.");
  });

  it("fails when product id is invalid UUID", () => {
    expect(validateProductInput({ ...validProduct, id: "bad-id" })).toBe("Invalid product ID.");
  });
});
