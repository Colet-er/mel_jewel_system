export interface CustomerInput {
  id?: string;
  name: string;
  fbName?: string | null;
  address?: string | null;
  phone?: string | null;
  notes?: string | null;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateCustomerInput(input: CustomerInput): string | null {
  if (!input.name || !input.name.trim()) {
    return "Customer name is required.";
  }
  if (input.name.trim().length > 150) {
    return "Customer name cannot exceed 150 characters.";
  }
  if (input.fbName && input.fbName.length > 150) {
    return "Facebook name cannot exceed 150 characters.";
  }
  if (input.address && input.address.length > 500) {
    return "Address cannot exceed 500 characters.";
  }
  if (input.phone && input.phone.length > 50) {
    return "Phone number cannot exceed 50 characters.";
  }
  if (input.notes && input.notes.length > 1000) {
    return "Notes cannot exceed 1000 characters.";
  }
  if (input.id && !UUID_PATTERN.test(input.id)) {
    return "Invalid customer ID.";
  }
  return null;
}
