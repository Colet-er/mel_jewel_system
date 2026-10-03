import { describe, it, expect } from "vitest";
import type { ConfirmOptions, ConfirmVariant } from "@/components/ui/confirm-dialog";

describe("ConfirmDialog contracts", () => {
  it("supports primary, danger, and warning variants", () => {
    const variants: ConfirmVariant[] = ["primary", "danger", "warning"];
    expect(variants).toHaveLength(3);

    const deleteOptions: ConfirmOptions = {
      title: "Delete Customer",
      description: "Are you sure?",
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      variant: "danger",
    };

    expect(deleteOptions.title).toBe("Delete Customer");
    expect(deleteOptions.variant).toBe("danger");
  });

  it("handles basic save options", () => {
    const saveOptions: ConfirmOptions = {
      title: "Save Changes",
      description: "Are you sure you want to save changes?",
      confirmLabel: "Save",
      variant: "primary",
    };

    expect(saveOptions.confirmLabel).toBe("Save");
    expect(saveOptions.variant).toBe("primary");
  });
});
