"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import {
  createReservation,
  updateReservation,
  type ReservationInput,
} from "@/app/(dashboard)/orders/reserved/actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils/format";
import { PAYMENT_METHODS } from "@/lib/utils/payment-validation";
import { createClient } from "@/lib/supabase/client";

export type ReservationTypeOption = "Regular" | "Pasabuy" | "COD";
export const RESERVATION_TYPE_OPTIONS: ReservationTypeOption[] = [
  "Regular",
  "Pasabuy",
  "COD",
];

export interface ReservationFormValues {
  invoiceNumber: string;
  fbName: string;
  customerName: string;
  customerAddress: string;
  phone: string;
  itemName: string;
  itemCode: string;
  category: string;
  quantity: string;
  price: string;
  discount: string;
  shippingFee: string;
  downpayment: string;
  downpaymentMethod: string;
  type: ReservationTypeOption;
}

const EMPTY_VALUES: ReservationFormValues = {
  invoiceNumber: "",
  fbName: "",
  customerName: "",
  customerAddress: "",
  phone: "",
  itemName: "",
  itemCode: "",
  category: "",
  quantity: "1",
  price: "",
  discount: "0",
  shippingFee: "0",
  downpayment: "0",
  downpaymentMethod: "",
  type: "Regular",
};

interface ReservationFormModalProps {
  mode: "create" | "edit";
  orderId?: string;
  initial?: ReservationFormValues;
  onClose: () => void;
}

interface MoissaniteInventoryOption {
  id: string;
  sku: string;
  item_name: string;
  description: string | null;
  selling_price: number;
  setting: string | null;
  category: { name: string } | null;
}

const selectClass =
  "h-10 w-full rounded-lg border border-white/10 bg-background/55 px-3 text-sm text-foreground shadow-inner shadow-black/5 transition-all duration-200 hover:border-white/20 focus:border-primary focus:bg-background/80 focus:ring-4 focus:ring-primary/10";

const sectionHeadingClass =
  "col-span-full border-b border-white/[0.07] pb-2 text-xs font-semibold uppercase tracking-wider text-pink-light";

function parseNumber(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Quantity × price minus the optional discount, rounded to centavos. */
function netTotal(quantity: string, price: string, discount: string): number {
  const qty = parseNumber(quantity);
  const unitPrice = parseNumber(price);
  const parsedDiscount = Number.isFinite(parseNumber(discount))
    ? parseNumber(discount)
    : 0;
  if (!Number.isFinite(qty) || !Number.isFinite(unitPrice)) return Number.NaN;
  return round2(qty * unitPrice - parsedDiscount);
}

export function ReservationFormModal({
  mode,
  orderId,
  initial = EMPTY_VALUES,
  onClose,
}: ReservationFormModalProps) {
  const router = useRouter();
  const [values, setValues] = useState<ReservationFormValues>(initial);
  const [error, setError] = useState<string | null>(null);
  const [inventoryItems, setInventoryItems] = useState<MoissaniteInventoryOption[]>([]);
  const [selectedInventoryId, setSelectedInventoryId] = useState("");
  const [itemSource, setItemSource] = useState<"manual" | "moissanite">("manual");
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [inventoryLoadError, setInventoryLoadError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const originalStyle = window.document.body.style.overflow;
    window.document.body.style.overflow = "hidden";
    return () => {
      window.document.body.style.overflow = originalStyle;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    void supabase
      .from("moissanite_skus")
      .select("id,sku,item_name,description,selling_price,setting,category:categories(name)")
      .neq("status", "archived")
      .order("sku")
      .then(({ data, error: inventoryError }) => {
        if (!active) return;
        setInventoryLoading(false);
        if (inventoryError) {
          setInventoryLoadError("Could not load the Moissanite catalog. You can still enter item details manually.");
          return;
        }
        const items = (data ?? []).map((item) => ({
          ...item,
          selling_price: Number(item.selling_price),
          category: Array.isArray(item.category) ? item.category[0] ?? null : item.category,
        })) as MoissaniteInventoryOption[];
        setInventoryItems(items);
        const existing = items.find((item) => item.sku.toLowerCase() === initial.itemCode.trim().toLowerCase());
        if (existing) {
          setSelectedInventoryId(existing.id);
          setItemSource("moissanite");
        }
      });
    return () => { active = false; };
  }, [initial.itemCode]);

  function selectInventoryItem(id: string) {
    setSelectedInventoryId(id);
    if (!id) return;
    const item = inventoryItems.find((candidate) => candidate.id === id);
    if (!item) return;
    setValues((current) => ({
      ...current,
      itemCode: item.sku,
      itemName: item.description || item.item_name,
      category: item.category?.name ?? "Moissanite",
      price: item.selling_price.toFixed(2),
    }));
    setError(null);
  }

  function handleBackdropClick(event: React.MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  function update<K extends keyof ReservationFormValues>(
    key: K,
    value: ReservationFormValues[K]
  ) {
    setValues((current) => ({ ...current, [key]: value }));
    setError(null);
  }

  function buildInput(): ReservationInput {
    const quantity = Math.trunc(parseNumber(values.quantity));
    const price = parseNumber(values.price);
    return {
      invoiceNumber: values.invoiceNumber.trim(),
      fbName: values.fbName.trim(),
      customerName: values.customerName.trim(),
      customerAddress: values.customerAddress.trim(),
      phone: values.phone.trim(),
      itemName: values.itemName.trim(),
      itemCode: values.itemCode.trim(),
      category: values.category.trim(),
      quantity,
      amount:
        Number.isFinite(quantity) && Number.isFinite(price)
          ? round2(quantity * price)
          : Number.NaN,
      discount: parseNumber(values.discount || "0") || 0,
      shippingFee: parseNumber(values.shippingFee || "0") || 0,
      downpayment: parseNumber(values.downpayment || "0") || 0,
      downpaymentMethod: values.downpaymentMethod,
      type: values.type.toLowerCase() as ReservationInput["type"],
    };
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (isPending) return;
    if (itemSource === "moissanite" && !selectedInventoryId) {
      setError("Select a Moissanite item from the dropdown.");
      return;
    }

    const input = buildInput();

    startTransition(async () => {
      const result =
        mode === "create"
          ? await createReservation(input)
          : await updateReservation(orderId ?? "", input);

      if (result.ok) {
        router.refresh();
        onClose();
      } else {
        setError(result.message);
      }
    });
  }

  const total = netTotal(values.quantity, values.price, values.discount);
  const originalDownpayment = parseNumber(initial.downpayment || "0") || 0;
  const editedDownpayment = parseNumber(values.downpayment || "0") || 0;
  const needsDownpaymentMethod =
    (mode === "create" && editedDownpayment > 0) ||
    (mode === "edit" && editedDownpayment > originalDownpayment);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 py-10"
      role="dialog"
      aria-modal="true"
      aria-label={mode === "create" ? "Add Reservation" : "Edit Reservation"}
      onClick={handleBackdropClick}
    >
      <div className="w-full max-w-4xl rounded-xl border border-white/10 bg-background shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
          <h2 className="text-base font-semibold text-foreground">
            {mode === "create" ? "Add Reservation" : "Edit Reservation"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close form"
            className="rounded-md p-1.5 text-muted transition-colors hover:bg-elevated hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <form noValidate onSubmit={handleSubmit} className="space-y-5 px-5 py-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <h3 className={sectionHeadingClass}>Basic Information</h3>

            <div>
              <Label htmlFor="reservation-fb-name">FB Name</Label>
              <Input
                id="reservation-fb-name"
                value={values.fbName}
                onChange={(event) => update("fbName", event.target.value)}
                placeholder="e.g. Maria S."
                autoComplete="off"
              />
            </div>

            <div>
              <Label htmlFor="reservation-invoice-number">Invoice Number</Label>
              <Input
                id="reservation-invoice-number"
                value={
                  mode === "create"
                    ? "Auto-generated upon save"
                    : values.invoiceNumber
                }
                readOnly
                disabled
                aria-readonly="true"
              />
            </div>

            <div>
              <Label htmlFor="reservation-type">Type</Label>
              <select
                id="reservation-type"
                value={values.type}
                onChange={(event) =>
                  update("type", event.target.value as ReservationTypeOption)
                }
                className={selectClass}
              >
                {RESERVATION_TYPE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <h3 className={`${sectionHeadingClass} mt-2`}>Shipping Information</h3>

            <div>
              <Label htmlFor="reservation-customer-name">Customer Name</Label>
              <Input
                id="reservation-customer-name"
                value={values.customerName}
                onChange={(event) => update("customerName", event.target.value)}
                placeholder="e.g. Maria Santos"
                autoComplete="off"
              />
            </div>

            <div>
              <Label htmlFor="reservation-phone">Phone</Label>
              <Input
                id="reservation-phone"
                type="tel"
                value={values.phone}
                onChange={(event) => update("phone", event.target.value)}
                placeholder="+63 9xx xxx xxxx"
                autoComplete="off"
              />
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="reservation-customer-address">Address</Label>
              <Input
                id="reservation-customer-address"
                value={values.customerAddress}
                onChange={(event) => update("customerAddress", event.target.value)}
                placeholder="Delivery address"
                autoComplete="off"
              />
            </div>

            <h3 className={`${sectionHeadingClass} mt-2`}>Item Details</h3>

            <div className="rounded-xl border border-primary/15 bg-primary/[0.035] p-4 sm:col-span-2">
              <div className="mb-4">
                <p className="text-sm font-semibold text-foreground">Select where the item comes from</p>
                <p className="mt-1 text-xs leading-5 text-muted">Use the Moissanite catalog dropdown to fill item details automatically, or choose manual entry for other products.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="reservation-item-source">Item Source</Label>
                  <select
                    id="reservation-item-source"
                    value={itemSource}
                    onChange={(event) => {
                      const source = event.target.value as "manual" | "moissanite";
                      setItemSource(source);
                      if (source === "manual") setSelectedInventoryId("");
                      setError(null);
                    }}
                    className={selectClass}
                  >
                    <option value="manual">Manual Item</option>
                    <option value="moissanite">Moissanite Catalog</option>
                  </select>
                </div>
                {itemSource === "moissanite" ? (
                  <div>
                    <Label htmlFor="reservation-inventory-item">Moissanite Item</Label>
                    <select
                      id="reservation-inventory-item"
                      value={selectedInventoryId}
                      onChange={(event) => selectInventoryItem(event.target.value)}
                      className={selectClass}
                      disabled={inventoryLoading || Boolean(inventoryLoadError)}
                      required
                    >
                      <option value="">{inventoryLoading ? "Loading catalog…" : "Select an item"}</option>
                      {inventoryItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.sku} — {item.description || item.item_name} — {formatCurrency(item.selling_price)}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </div>
              {itemSource === "moissanite" && inventoryLoadError ? <p className="mt-3 rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-xs text-danger" role="alert">{inventoryLoadError}</p> : null}
              {itemSource === "moissanite" && !inventoryLoading && !inventoryLoadError && inventoryItems.length === 0 ? <p className="mt-3 text-xs text-muted">No Moissanite items are available. Add items under Moissanite Inventory first.</p> : null}
              {selectedInventoryId ? (() => {
                const selected = inventoryItems.find((item) => item.id === selectedInventoryId);
                return selected ? (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/15 bg-background/55 px-3 py-2.5">
                    <div><p className="text-xs text-muted">Selected item</p><p className="mt-0.5 text-sm font-medium text-foreground">{selected.description || selected.item_name}</p></div>
                    <div className="text-right"><p className="text-sm font-semibold text-pink-light">{formatCurrency(selected.selling_price)}</p><p className="mt-0.5 text-xs text-muted">{selected.setting || "Setting not specified"}</p></div>
                  </div>
                ) : null;
              })() : null}
            </div>

            <div className="sm:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Reservation item values</p>
            </div>

            <div>
              <Label htmlFor="reservation-item-code">Item Code</Label>
              <Input
                id="reservation-item-code"
                value={values.itemCode}
                onChange={(event) => {
                  setSelectedInventoryId("");
                  setItemSource("manual");
                  update("itemCode", event.target.value);
                }}
                placeholder="SKU / product code"
                autoComplete="off"
              />
            </div>
            <div>
              <Label htmlFor="reservation-item-name">Item Name</Label>
              <Input
                id="reservation-item-name"
                value={values.itemName}
                onChange={(event) => update("itemName", event.target.value)}
                placeholder="Item being reserved"
                autoComplete="off"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="reservation-category">Category</Label>
              <Input
                id="reservation-category"
                value={values.category}
                onChange={(event) => update("category", event.target.value)}
                placeholder="e.g. Pearls"
                autoComplete="off"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            <div>
              <Label htmlFor="reservation-quantity">Quantity</Label>
              <Input
                id="reservation-quantity"
                type="number"
                min={1}
                step={1}
                value={values.quantity}
                onChange={(event) => update("quantity", event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="reservation-price">Price</Label>
              <Input
                id="reservation-price"
                type="number"
                min={0}
                step="0.01"
                value={values.price}
                onChange={(event) => update("price", event.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label htmlFor="reservation-discount">Discount</Label>
              <Input
                id="reservation-discount"
                type="number"
                min={0}
                step="0.01"
                value={values.discount}
                onChange={(event) => update("discount", event.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label htmlFor="reservation-amount">Amount</Label>
              <Input
                id="reservation-amount"
                value={Number.isFinite(total) ? total.toFixed(2) : ""}
                readOnly
                disabled
                aria-readonly="true"
                placeholder="0.00"
              />
            </div>
            <div>
              <Label htmlFor="reservation-shipping-fee">Shipping Fee</Label>
              <Input
                id="reservation-shipping-fee"
                type="number"
                min={0}
                step="0.01"
                value={values.shippingFee}
                onChange={(event) => update("shippingFee", event.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label htmlFor="reservation-downpayment">Downpayment (DP)</Label>
              <Input
                id="reservation-downpayment"
                type="number"
                min={0}
                step="0.01"
                value={values.downpayment}
                onChange={(event) => update("downpayment", event.target.value)}
                placeholder="0.00"
              />
            </div>
            {needsDownpaymentMethod ? (
              <div>
                <Label htmlFor="reservation-downpayment-method">DP Payment Method</Label>
                <select
                  id="reservation-downpayment-method"
                  value={values.downpaymentMethod}
                  onChange={(event) => update("downpaymentMethod", event.target.value)}
                  required
                  className={selectClass}
                >
                  <option value="">Select method</option>
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method} value={method}>{method}</option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>

          {mode === "edit" ? (
            <p className="text-xs text-muted">
              Increasing DP records only the difference as a new payment. Existing payment history cannot be reduced or overwritten.
            </p>
          ) : null}

          {Number.isFinite(total) && values.price !== "" ? (
            <p className="text-sm text-muted">
              Total after discount:{" "}
              <span className="font-semibold text-foreground">
                {formatCurrency(total)}
              </span>
              {parseNumber(values.discount) > 0 ? (
                <> (discount −{formatCurrency(parseNumber(values.discount))})</>
              ) : null}
            </p>
          ) : null}

          {error ? (
            <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          ) : null}

          <div className="flex items-center justify-end gap-3 border-t border-white/[0.07] pt-4">
            <Button variant="secondary" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? "Saving…"
                : mode === "create"
                  ? "Save Reservation"
                  : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
