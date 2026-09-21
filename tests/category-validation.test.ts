import { describe, expect, it } from "vitest";
import { validateCategoryInput } from "@/lib/utils/category-validation";

describe("validateCategoryInput", () => {
  const validCategory = {
    name: "South Sea Pearls",
    description: "High quality golden and white pearls",
  };

  it("passes for valid category input", () => {
    expect(validateCategoryInput(validCategory)).toBeNull();
  });

  it("passes without description", () => {
    expect(validateCategoryInput({ name: "Rings" })).toBeNull();
  });

  it("fails when category name is empty or whitespace", () => {
    expect(validateCategoryInput({ name: "" })).toBe("Category name is required.");
    expect(validateCategoryInput({ name: "   " })).toBe("Category name is required.");
  });

  it("fails when category name exceeds 100 characters", () => {
    expect(validateCategoryInput({ name: "A".repeat(101) })).toBe(
      "Category name cannot exceed 100 characters."
    );
  });

  it("fails when description exceeds 500 characters", () => {
    expect(
      validateCategoryInput({
        name: "Earrings",
        description: "A".repeat(501),
      })
    ).toBe("Description cannot exceed 500 characters.");
  });

  it("fails when id is invalid UUID", () => {
    expect(
      validateCategoryInput({
        id: "invalid-id",
        name: "Necklaces",
      })
    ).toBe("Invalid category ID.");
  });
});
