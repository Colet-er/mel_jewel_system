export interface CategoryInput {
  id?: string;
  name: string;
  description?: string | null;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateCategoryInput(input: CategoryInput): string | null {
  if (!input.name || !input.name.trim()) {
    return "Category name is required.";
  }
  if (input.name.trim().length > 100) {
    return "Category name cannot exceed 100 characters.";
  }
  if (input.description && input.description.length > 500) {
    return "Description cannot exceed 500 characters.";
  }
  if (input.id && !UUID_PATTERN.test(input.id)) {
    return "Invalid category ID.";
  }
  return null;
}
