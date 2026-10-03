import { describe, expect, it } from "vitest";
import { validateCustomerInput } from "@/lib/utils/customer-validation";

describe("validateCustomerInput", () => {
  it("passes for valid customer input", () => {
    const error = validateCustomerInput({
      name: "Maria Santos",
      fbName: "Maria Santos PH",
      address: "123 Pearl St, Makati City",
      phone: "0917 123 4567",
      notes: "Preferred delivery on weekends",
    });
    expect(error).toBeNull();
  });

  it("passes with only required name", () => {
    const error = validateCustomerInput({
      name: "John Doe",
    });
    expect(error).toBeNull();
  });

  it("fails when name is missing or empty", () => {
    expect(validateCustomerInput({ name: "" })).toBe("Customer name is required.");
    expect(validateCustomerInput({ name: "   " })).toBe("Customer name is required.");
  });

  it("fails when name exceeds maximum length", () => {
    const longName = "A".repeat(151);
    expect(validateCustomerInput({ name: longName })).toBe(
      "Customer name cannot exceed 150 characters."
    );
  });

  it("fails when address exceeds maximum length", () => {
    const longAddress = "A".repeat(501);
    expect(
      validateCustomerInput({
        name: "Valid Name",
        address: longAddress,
      })
    ).toBe("Address cannot exceed 500 characters.");
  });

  it("validates UUID if id is provided", () => {
    expect(
      validateCustomerInput({
        id: "invalid-uuid",
        name: "Valid Name",
      })
    ).toBe("Invalid customer ID.");

    expect(
      validateCustomerInput({
        id: "123e4567-e89b-12d3-a456-426614174000",
        name: "Valid Name",
      })
    ).toBeNull();
  });
});
