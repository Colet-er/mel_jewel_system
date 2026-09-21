export interface ProductInput {
  id?: string;
  name: string;
  sku?: string | null;
  categoryId?: string | null;
  price: number;
  cost?: number;
  stock?: number;
  isActive?: boolean;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateProductInput(input: ProductInput): string | null {
  if (!input.name || !input.name.trim()) {
    return "Product name is required.";
  }
  if (input.name.trim().length > 200) {
    return "Product name cannot exceed 200 characters.";
  }
  if (!Number.isFinite(input.price) || input.price < 0) {
    return "Price must be zero or greater.";
  }
  if (input.cost !== undefined && (!Number.isFinite(input.cost) || input.cost < 0)) {
    return "Cost must be zero or greater.";
  }
  if (input.stock !== undefined && (!Number.isInteger(input.stock) || input.stock < 0)) {
    return "Stock must be a non-negative whole number.";
  }
  if (input.categoryId && !UUID_PATTERN.test(input.categoryId)) {
    return "Invalid category.";
  }
  if (input.id && !UUID_PATTERN.test(input.id)) {
    return "Invalid product ID.";
  }
  return null;
}
