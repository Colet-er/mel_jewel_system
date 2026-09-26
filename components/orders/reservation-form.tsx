"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, X } from "lucide-react";
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

export interface FormLineItem {
  id: string;
  itemSource: "moissanite" | "product";
  selectedInventoryId: string;
  selectedProductId?: string;
  itemCode: string;
  itemName: string;
  category: string;
  quantity: string;
  price: string;
}

export interface ReservationFormValues {
  invoiceNumber: string;
  fbName: string;
  customerName: string;
  customerAddress: string;
  phone: string;
  items: FormLineItem[];
  discount: string;
  shippingFee: string;
  downpayment: string;
  downpaymentMethod: string;
  type: ReservationTypeOption;
  // Optional single-item legacy fallback
  itemName?: string;
  itemCode?: string;
  category?: string;
  quantity?: string;
  price?: string;
}

function createEmptyItem(idPrefix: string = "item"): FormLineItem {
  return {
    id: `${idPrefix}-${Math.random().toString(36).substring(2, 9)}`,
    itemSource: "product",
    selectedInventoryId: "",
    selectedProductId: "",
    itemCode: "",
    itemName: "",
    category: "",
    quantity: "1",
    price: "",
  };
}

function normalizeInitialValues(initial?: Partial<ReservationFormValues>): ReservationFormValues {
  let initialItems: FormLineItem[] = [];

  if (initial?.items && initial.items.length > 0) {
    initialItems = initial.items.map((item, idx) => ({
      id: item.id || `item-${idx}-${Math.random().toString(36).substring(2, 9)}`,
      itemSource:
        item.itemSource === "moissanite" || Boolean(item.selectedInventoryId)
          ? "moissanite"
          : "product",
      selectedInventoryId: item.selectedInventoryId || "",
      selectedProductId: item.selectedProductId || "",
      itemCode: item.itemCode || "",
      itemName: item.itemName || "",
      category: item.category || "",
      quantity: String(item.quantity || "1"),
      price: String(item.price ?? ""),
    }));
  } else if (initial?.itemName || initial?.price) {
    initialItems = [
      {
        id: `item-${Math.random().toString(36).substring(2, 9)}`,
        itemSource: "product",
        selectedInventoryId: "",
        selectedProductId: "",
        itemCode: initial.itemCode || "",
        itemName: initial.itemName || "",
        category: initial.category || "",
        quantity: String(initial.quantity || "1"),
        price: String(initial.price || ""),
      },
    ];
  } else {
    initialItems = [createEmptyItem("initial")];
  }

  return {
    invoiceNumber: initial?.invoiceNumber || "",
    fbName: initial?.fbName || "",
    customerName: initial?.customerName || "",
    customerAddress: initial?.customerAddress || "",
    phone: initial?.phone || "",
    items: initialItems,
    discount: initial?.discount || "0",
    shippingFee: initial?.shippingFee || "0",
    downpayment: initial?.downpayment || "0",
    downpaymentMethod: initial?.downpaymentMethod || "",
    type: initial?.type || "Regular",
  };
}

interface ReservationFormModalProps {
  mode: "create" | "edit";
  orderId?: string;
  initial?: Partial<ReservationFormValues>;
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

interface ProductCatalogOption {
  id: string;
  name: string;
  sku: string | null;
  price: number;
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

export function ReservationFormModal({
  mode,
  orderId,
  initial,
  onClose,
}: ReservationFormModalProps) {
  const router = useRouter();
  const baseId = useId();
  const [values, setValues] = useState<ReservationFormValues>(() => normalizeInitialValues(initial));
  const [error, setError] = useState<string | null>(null);
  const [inventoryItems, setInventoryItems] = useState<MoissaniteInventoryOption[]>([]);
  const [productItems, setProductItems] = useState<ProductCatalogOption[]>([]);
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
    void Promise.all([
      supabase
        .from("moissanite_skus")
        .select("id,sku,item_name,description,selling_price,setting,category:categories(name)")
        .neq("status", "archived")
        .order("sku"),
      supabase
        .from("products")
        .select("id,name,sku,price,category:categories(name)")
        .eq("is_active", true)
        .eq("is_archived", false)
        .order("name"),
    ]).then(([moissaniteResult, productsResult]) => {
      if (!active) return;
      setInventoryLoading(false);
      if (moissaniteResult.error) {
        setInventoryLoadError("Could not load the Moissanite catalog. You can still enter item details manually.");
      } else if (moissaniteResult.data) {
        const items = moissaniteResult.data.map((item) => ({
          ...item,
          selling_price: Number(item.selling_price),
          category: Array.isArray(item.category) ? item.category[0] ?? null : item.category,
        })) as MoissaniteInventoryOption[];
        setInventoryItems(items);
      }

      if (!productsResult.error && productsResult.data) {
        const products = productsResult.data.map((prod) => ({
          ...prod,
          price: Number(prod.price),
          category: Array.isArray(prod.category) ? prod.category[0] ?? null : prod.category,
        })) as ProductCatalogOption[];
        setProductItems(products);
      }
    });
    return () => {
      active = false;
    };
  }, []);

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

  function handleAddItem() {
    setValues((current) => ({
      ...current,
      items: [...current.items, createEmptyItem("line")],
    }));
    setError(null);
  }

  function handleRemoveItem(index: number) {
    if (values.items.length <= 1) return;
    setValues((current) => ({
      ...current,
      items: current.items.filter((_, idx) => idx !== index),
    }));
    setError(null);
  }

  function handleUpdateItem(index: number, key: keyof FormLineItem, val: string) {
    setValues((current) => {
      const nextItems = [...current.items];
      nextItems[index] = { ...nextItems[index], [key]: val };
      return { ...current, items: nextItems };
    });
    setError(null);
  }

  function handleSelectInventoryItem(index: number, inventoryId: string) {
    const item = inventoryItems.find((candidate) => candidate.id === inventoryId);
    setValues((current) => {
      const nextItems = [...current.items];
      if (item) {
        nextItems[index] = {
          ...nextItems[index],
          selectedInventoryId: inventoryId,
          selectedProductId: "",
          itemSource: "moissanite",
          itemCode: item.sku,
          itemName: item.description || item.item_name,
          category: item.category?.name ?? "Moissanite",
          price: item.selling_price.toFixed(2),
        };
      } else {
        nextItems[index] = {
          ...nextItems[index],
          selectedInventoryId: "",
          itemCode: "",
          itemName: "",
          category: "",
          price: "",
        };
      }
      return { ...current, items: nextItems };
    });
    setError(null);
  }

  function handleSelectProductItem(index: number, productId: string) {
    const product = productItems.find((candidate) => candidate.id === productId);
    setValues((current) => {
      const nextItems = [...current.items];
      if (product) {
        nextItems[index] = {
          ...nextItems[index],
          selectedProductId: productId,
          selectedInventoryId: "",
          itemSource: "product",
          itemCode: product.sku || "",
          itemName: product.name,
          category: product.category?.name ?? "General",
          price: product.price.toFixed(2),
        };
      } else {
        nextItems[index] = {
          ...nextItems[index],
          selectedProductId: "",
          itemCode: "",
          itemName: "",
          category: "",
          price: "",
        };
      }
      return { ...current, items: nextItems };
    });
    setError(null);
  }

  // Calculate Subtotal (sum of all line totals: qty * unitPrice)
  let subtotal = 0;
  let hasValidItems = values.items.length > 0;
  for (const item of values.items) {
    const qty = parseNumber(item.quantity);
    const unitPrice = parseNumber(item.price);
    if (!Number.isFinite(qty) || !Number.isFinite(unitPrice) || qty < 1 || unitPrice < 0) {
      hasValidItems = false;
      break;
    }
    subtotal += qty * unitPrice;
  }
  subtotal = round2(subtotal);

  const discount = Number.isFinite(parseNumber(values.discount)) ? parseNumber(values.discount) : 0;
  const shippingFee = Number.isFinite(parseNumber(values.shippingFee)) ? parseNumber(values.shippingFee) : 0;
  const totalAmount = round2(Math.max(0, subtotal - discount));
  const grandTotal = round2(totalAmount + shippingFee);

  function buildInput(): ReservationInput {
    const lineItems = values.items.map((it) => {
      const qty = Math.max(1, Math.trunc(parseNumber(it.quantity) || 1));
      const price = parseNumber(it.price) || 0;
      return {
        itemName: it.itemName.trim(),
        itemCode: it.itemCode.trim() || undefined,
        category: it.category.trim() || undefined,
        quantity: qty,
        unitPrice: price,
      };
    });

    const first = lineItems[0];
    const totalQty = lineItems.reduce((sum, item) => sum + item.quantity, 0);

    return {
      invoiceNumber: values.invoiceNumber.trim(),
      fbName: values.fbName.trim(),
      customerName: values.customerName.trim(),
      customerAddress: values.customerAddress.trim(),
      phone: values.phone.trim(),
      items: lineItems,
      itemName: first?.itemName ?? "",
      itemCode: first?.itemCode ?? "",
      category: first?.category ?? "",
      quantity: totalQty,
      amount: hasValidItems ? subtotal : Number.NaN,
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

    for (let i = 0; i < values.items.length; i++) {
      const item = values.items[i];
      if (item.itemSource === "moissanite" && !item.selectedInventoryId) {
        setError(`Select a Moissanite item for line item #${i + 1}.`);
        return;
      }
      if (item.itemSource === "product" && !item.selectedProductId) {
        setError(`Select a product for line item #${i + 1}.`);
        return;
      }
      if (!item.itemName.trim()) {
        setError(`Item name is required for line item #${i + 1}.`);
        return;
      }
      const qty = parseNumber(item.quantity);
      if (!Number.isFinite(qty) || qty < 1) {
        setError(`Quantity must be at least 1 for line item #${i + 1}.`);
        return;
      }
      const price = parseNumber(item.price);
      if (!Number.isFinite(price) || price < 0) {
        setError(`Price cannot be negative for line item #${i + 1}.`);
        return;
      }
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

  const originalDownpayment = parseNumber(initial?.downpayment || "0") || 0;
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

        <form noValidate onSubmit={handleSubmit} className="space-y-6 px-5 py-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <h3 className={sectionHeadingClass}>Basic Information</h3>

            <div>
              <Label htmlFor={`${baseId}-fb-name`}>FB Name</Label>
              <Input
                id={`${baseId}-fb-name`}
                value={values.fbName}
                onChange={(event) => update("fbName", event.target.value)}
                placeholder="e.g. Maria S."
                autoComplete="off"
              />
            </div>

            <div>
              <Label htmlFor={`${baseId}-invoice-number`}>Invoice Number</Label>
              <Input
                id={`${baseId}-invoice-number`}
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

            <h3 className={`${sectionHeadingClass} mt-2`}>Shipping Information</h3>

            <div>
              <Label htmlFor={`${baseId}-customer-name`}>Customer Name</Label>
              <Input
                id={`${baseId}-customer-name`}
                value={values.customerName}
                onChange={(event) => update("customerName", event.target.value)}
                placeholder="e.g. Maria Santos"
                autoComplete="off"
              />
            </div>

            <div>
              <Label htmlFor={`${baseId}-phone`}>Phone</Label>
              <Input
                id={`${baseId}-phone`}
                type="tel"
                value={values.phone}
                onChange={(event) => update("phone", event.target.value)}
                placeholder="+63 9xx xxx xxxx"
                autoComplete="off"
              />
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor={`${baseId}-customer-address`}>Address</Label>
              <Input
                id={`${baseId}-customer-address`}
                value={values.customerAddress}
                onChange={(event) => update("customerAddress", event.target.value)}
                placeholder="Delivery address"
                autoComplete="off"
              />
            </div>
          </div>

          {/* Items Section for Bulk Ordering */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] pb-2">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-pink-light">
                  Order Items ({values.items.length} {values.items.length === 1 ? "Item" : "Items"} — Bulk Ordering)
                </h3>
              </div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={handleAddItem}
                className="gap-1.5"
              >
                <Plus className="h-4 w-4" aria-hidden />
                Add Item
              </Button>
            </div>

            <div className="space-y-4">
              {values.items.map((item, index) => {
                const itemTotal =
                  Number.isFinite(parseNumber(item.quantity)) && Number.isFinite(parseNumber(item.price))
                    ? round2(parseNumber(item.quantity) * parseNumber(item.price))
                    : 0;

                return (
                  <div
                    key={item.id}
                    className="relative rounded-xl border border-white/10 bg-white/[0.025] p-4 transition-all hover:border-white/20"
                  >
                    <div className="flex items-center justify-between gap-2 mb-3 border-b border-white/5 pb-2">
                      <span className="text-xs font-bold text-pink-light">
                        Item #{index + 1}
                      </span>
                      {values.items.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          aria-label={`Remove item #${index + 1}`}
                          className="flex items-center gap-1 text-xs text-danger/80 hover:text-danger transition-colors p-1 rounded hover:bg-danger/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                          <span>Remove</span>
                        </button>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <div>
                        <Label htmlFor={`item-source-${item.id}`}>Item Source</Label>
                        <select
                          id={`item-source-${item.id}`}
                          value={item.itemSource}
                          onChange={(e) => {
                            const source = e.target.value as "moissanite" | "product";
                            handleUpdateItem(index, "itemSource", source);
                            handleUpdateItem(index, "selectedInventoryId", "");
                            handleUpdateItem(index, "selectedProductId", "");
                            handleUpdateItem(index, "itemCode", "");
                            handleUpdateItem(index, "itemName", "");
                            handleUpdateItem(index, "category", "");
                            handleUpdateItem(index, "price", "");
                          }}
                          className={selectClass}
                        >
                          <option value="product">Product Catalog</option>
                          <option value="moissanite">Moissanite Catalog</option>
                        </select>
                      </div>

                      {item.itemSource === "moissanite" ? (
                        <div className="sm:col-span-2">
                          <Label htmlFor={`item-inventory-${item.id}`}>Moissanite Catalog Item</Label>
                          <select
                            id={`item-inventory-${item.id}`}
                            value={item.selectedInventoryId}
                            onChange={(e) => handleSelectInventoryItem(index, e.target.value)}
                            className={selectClass}
                            disabled={inventoryLoading || Boolean(inventoryLoadError)}
                            required
                          >
                            <option value="">
                              {inventoryLoading ? "Loading catalog…" : "Select a Moissanite item"}
                            </option>
                            {inventoryItems.map((inv) => (
                              <option key={inv.id} value={inv.id}>
                                {inv.sku} — {inv.description || inv.item_name} — {formatCurrency(inv.selling_price)}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div className="sm:col-span-2">
                          <Label htmlFor={`item-product-${item.id}`}>Product Catalog Item</Label>
                          <select
                            id={`item-product-${item.id}`}
                            value={item.selectedProductId || ""}
                            onChange={(e) => handleSelectProductItem(index, e.target.value)}
                            className={selectClass}
                            disabled={inventoryLoading}
                            required
                          >
                            <option value="">
                              {inventoryLoading ? "Loading catalog…" : "Select a product"}
                            </option>
                            {productItems.map((prod) => (
                              <option key={prod.id} value={prod.id}>
                                {prod.name} {prod.sku ? `(${prod.sku})` : ""} — {formatCurrency(prod.price)}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div>
                        <Label htmlFor={`item-name-${item.id}`}>Item Name</Label>
                        <Input
                          id={`item-name-${item.id}`}
                          value={item.itemName}
                          onChange={(e) => handleUpdateItem(index, "itemName", e.target.value)}
                          placeholder="Item name / description"
                          autoComplete="off"
                        />
                      </div>

                      <div>
                        <Label htmlFor={`item-category-${item.id}`}>Category</Label>
                        <Input
                          id={`item-category-${item.id}`}
                          value={item.category}
                          onChange={(e) => handleUpdateItem(index, "category", e.target.value)}
                          placeholder="e.g. Pearls, Ring"
                          autoComplete="off"
                        />
                      </div>

                      <div>
                        <Label htmlFor={`item-qty-${item.id}`}>Quantity</Label>
                        <Input
                          id={`item-qty-${item.id}`}
                          type="number"
                          min={1}
                          step={1}
                          value={item.quantity}
                          onChange={(e) => handleUpdateItem(index, "quantity", e.target.value)}
                        />
                      </div>

                      <div>
                        <Label htmlFor={`item-price-${item.id}`}>Unit Price</Label>
                        <Input
                          id={`item-price-${item.id}`}
                          type="number"
                          min={0}
                          step="0.01"
                          value={item.price}
                          onChange={(e) => handleUpdateItem(index, "price", e.target.value)}
                          placeholder="0.00"
                        />
                      </div>

                      <div className="flex flex-col justify-end">
                        <Label>Line Total</Label>
                        <div className="flex h-10 items-center justify-end rounded-lg border border-white/10 bg-white/[0.03] px-3 font-semibold text-pink-light">
                          {formatCurrency(itemTotal)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pricing & Downpayment Breakdown */}
          <div className="space-y-4 border-t border-white/[0.07] pt-4">
            <h3 className={sectionHeadingClass}>Payment & Totals</h3>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              <div>
                <Label htmlFor={`${baseId}-subtotal`}>Subtotal (Items)</Label>
                <Input
                  id={`${baseId}-subtotal`}
                  value={hasValidItems ? formatCurrency(subtotal) : "—"}
                  readOnly
                  disabled
                  aria-readonly="true"
                />
              </div>

              <div>
                <Label htmlFor={`${baseId}-discount`}>Discount</Label>
                <Input
                  id={`${baseId}-discount`}
                  type="number"
                  min={0}
                  step="0.01"
                  value={values.discount}
                  onChange={(event) => update("discount", event.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div>
                <Label htmlFor={`${baseId}-shipping-fee`}>Shipping Fee</Label>
                <Input
                  id={`${baseId}-shipping-fee`}
                  type="number"
                  min={0}
                  step="0.01"
                  value={values.shippingFee}
                  onChange={(event) => update("shippingFee", event.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div>
                <Label htmlFor={`${baseId}-grand-total`}>Total Amount</Label>
                <Input
                  id={`${baseId}-grand-total`}
                  value={hasValidItems ? formatCurrency(grandTotal) : "—"}
                  readOnly
                  disabled
                  aria-readonly="true"
                  className="font-bold text-pink-light"
                />
              </div>

              <div>
                <Label htmlFor={`${baseId}-downpayment`}>Downpayment (DP)</Label>
                <Input
                  id={`${baseId}-downpayment`}
                  type="number"
                  min={0}
                  step="0.01"
                  value={values.downpayment}
                  onChange={(event) => update("downpayment", event.target.value)}
                  placeholder="0.00"
                />
              </div>

              {needsDownpaymentMethod ? (
                <div className="sm:col-span-2">
                  <Label htmlFor={`${baseId}-downpayment-method`}>DP Payment Method</Label>
                  <select
                    id={`${baseId}-downpayment-method`}
                    value={values.downpaymentMethod}
                    onChange={(event) => update("downpaymentMethod", event.target.value)}
                    required
                    className={selectClass}
                  >
                    <option value="">Select payment method</option>
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

            {hasValidItems ? (
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm flex flex-wrap items-center justify-between gap-2">
                <span className="text-muted">
                  Remaining Balance:{" "}
                  <strong className="text-foreground">
                    {formatCurrency(Math.max(0, grandTotal - (parseNumber(values.downpayment) || 0)))}
                  </strong>
                </span>
                {parseNumber(values.discount) > 0 ? (
                  <span className="text-xs text-muted">
                    Discount applied: −{formatCurrency(parseNumber(values.discount))}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

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
