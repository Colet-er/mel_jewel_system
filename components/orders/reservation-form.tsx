"use client";

import { useEffect, useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, History, Plus, Sparkles, Trash2, X } from "lucide-react";
import {
  createReservation,
  updateReservation,
  type ReservationInput,
} from "@/app/(dashboard)/orders/reserved/actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { formatCurrency } from "@/lib/utils/format";
import { PAYMENT_METHODS } from "@/lib/utils/payment-validation";
import { createClient } from "@/lib/supabase/client";

import {
  RESERVATION_FORM_TYPES,
  dbTypeToForm,
  formTypeToDb,
  type ReservationFormType,
} from "@/lib/utils/reservation-type";

export type ReservationTypeOption = ReservationFormType;
export const RESERVATION_TYPE_OPTIONS: ReservationTypeOption[] = [...RESERVATION_FORM_TYPES];

export interface FormLineItem {
  id: string;
  itemCode: string;
  itemName: string;
  category: string;
  quantity: string;
  price: string;
  isExistingFromCompiledOrder?: boolean;
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
  /** Live / Chat, or "" when not chosen. */
  orderSource: "" | "live" | "chat";
  // Optional single-item legacy fallback
  itemName?: string;
  itemCode?: string;
  category?: string;
  quantity?: string;
  price?: string;
}

interface ActiveCustomerReservation {
  id: string;
  orderNumber: string;
  customerId?: string;
  customerName: string;
  fbName: string | null;
  phone: string | null;
  address: string | null;
  discount: number;
  shippingFee: number;
  downpayment: number;
  downpaymentMethod: string | null;
  type: ReservationTypeOption;
  createdAt: string;
  items: FormLineItem[];
}

function createEmptyItem(idPrefix: string = "item"): FormLineItem {
  return {
    id: `${idPrefix}-${Math.random().toString(36).substring(2, 9)}`,
    itemCode: "",
    itemName: "",
    category: "",
    quantity: "1",
    price: "",
    isExistingFromCompiledOrder: false,
  };
}

function normalizeInitialValues(initial?: Partial<ReservationFormValues>): ReservationFormValues {
  let initialItems: FormLineItem[] = [];

  if (initial?.items && initial.items.length > 0) {
    initialItems = initial.items.map((item, idx) => ({
      id: item.id || `item-${idx}-${Math.random().toString(36).substring(2, 9)}`,
      itemCode: item.itemCode || "",
      itemName: item.itemName || "",
      category: item.category || "",
      quantity: String(item.quantity || "1"),
      price: String(item.price ?? ""),
      isExistingFromCompiledOrder: item.isExistingFromCompiledOrder ?? false,
    }));
  } else if (initial?.itemName || initial?.price) {
    initialItems = [
      {
        id: `item-${Math.random().toString(36).substring(2, 9)}`,
        itemCode: initial.itemCode || "",
        itemName: initial.itemName || "",
        category: initial.category || "",
        quantity: String(initial.quantity || "1"),
        price: String(initial.price || ""),
        isExistingFromCompiledOrder: false,
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
    orderSource: initial?.orderSource || "",
  };
}

interface ReservationFormModalProps {
  mode: "create" | "edit";
  orderId?: string;
  initial?: Partial<ReservationFormValues>;
  onClose: () => void;
  onSuccess?: (message: string) => void;
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
  onSuccess,
}: ReservationFormModalProps) {
  const router = useRouter();
  const confirm = useConfirm();
  const baseId = useId();
  const [values, setValues] = useState<ReservationFormValues>(() => normalizeInitialValues(initial));
  const [error, setError] = useState<string | null>(null);
  const [activeReservations, setActiveReservations] = useState<ActiveCustomerReservation[]>([]);
  const [compiledOrderId, setCompiledOrderId] = useState<string | null>(null);
  const [ignoredMatchId, setIgnoredMatchId] = useState<string | null>(null);
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
        .from("orders")
        .select(`
          id,
          order_number,
          status,
          total_amount,
          discount,
          shipping_fee,
          reservation_type,
          created_at,
          customer:customers (
            id,
            name,
            fb_name,
            phone,
            address
          ),
          order_items (
            id,
            quantity,
            unit_price,
            product:products (
              id,
              name,
              sku,
              category:categories ( name )
            )
          ),
          payments:order_payments (
            amount,
            kind,
            payment_method
          )
        `)
        .eq("status", "reserved")
        .is("archived_at", null)
        .order("created_at", { ascending: false })
      .then((activeOrdersResult) => {
      if (!active) return;

      if (!activeOrdersResult.error && activeOrdersResult.data) {
        const parsedActive: ActiveCustomerReservation[] = activeOrdersResult.data.map((order) => {
          const cust = Array.isArray(order.customer) ? order.customer[0] : order.customer;
          const orderItems = Array.isArray(order.order_items) ? order.order_items : [];
          const payments = Array.isArray(order.payments) ? order.payments : [];

          const dpPayments = payments.filter((p) => p.kind === "downpayment");
          const totalDp = dpPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
          const dpMethod = dpPayments[0]?.payment_method || null;

          const resType: ReservationTypeOption = dbTypeToForm(order.reservation_type);

          const mappedItems: FormLineItem[] = orderItems.map((oi, idx) => {
            const prod = Array.isArray(oi.product) ? oi.product[0] : oi.product;
            const rawCat = prod?.category as { name?: string } | { name?: string }[] | null | undefined;
            const cat = Array.isArray(rawCat) ? rawCat[0]?.name ?? "" : rawCat?.name ?? "";
            return {
              id: oi.id || `prev-item-${idx}-${Math.random().toString(36).substring(2, 7)}`,
              itemCode: prod?.sku || "",
              itemName: prod?.name || "Reserved Item",
              category: cat,
              quantity: String(oi.quantity || 1),
              price: String(oi.unit_price || 0),
              isExistingFromCompiledOrder: true,
            };
          });

          return {
            id: order.id,
            orderNumber: order.order_number,
            customerId: cust?.id,
            customerName: cust?.name || "",
            fbName: cust?.fb_name || null,
            phone: cust?.phone || null,
            address: cust?.address || null,
            discount: Number(order.discount || 0),
            shippingFee: Number(order.shipping_fee || 0),
            downpayment: totalDp,
            downpaymentMethod: dpMethod,
            type: resType,
            createdAt: order.created_at,
            items: mappedItems,
          };
        });

        setActiveReservations(parsedActive);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  // Detect matching active reservation for the entered customer/FB name in create mode
  const trimmedFb = values.fbName.trim().toLowerCase();
  const trimmedCust = values.customerName.trim().toLowerCase();

  const matchingActiveReservation = useMemo(() => {
    if (mode !== "create") return null;
    if (!trimmedFb && !trimmedCust) return null;

    return (
      activeReservations.find((res) => {
        const fbMatch = Boolean(trimmedFb && res.fbName && res.fbName.toLowerCase() === trimmedFb);
        const custMatch = Boolean(trimmedCust && res.customerName && res.customerName.toLowerCase() === trimmedCust);
        return fbMatch || custMatch;
      }) || null
    );
  }, [mode, trimmedFb, trimmedCust, activeReservations]);

  function handleCompileWithExisting(res: ActiveCustomerReservation) {
    setCompiledOrderId(res.id);
    setIgnoredMatchId(null);

    setValues((current) => {
      // Retain any new items the user started filling that have content
      const userEnteredItems = current.items.filter(
        (it) =>
          !it.isExistingFromCompiledOrder &&
          (it.itemName.trim() || it.itemCode.trim() || parseNumber(it.price) > 0)
      );

      const newItemsToAdd =
        userEnteredItems.length > 0
          ? userEnteredItems
          : [createEmptyItem("new-line")];

      return {
        ...current,
        invoiceNumber: res.orderNumber,
        fbName: res.fbName || current.fbName,
        customerName: res.customerName || current.customerName,
        phone: res.phone || current.phone,
        customerAddress: res.address || current.customerAddress,
        discount: String(res.discount),
        shippingFee: String(res.shippingFee),
        downpayment: String(res.downpayment),
        downpaymentMethod: res.downpaymentMethod || current.downpaymentMethod,
        type: res.type || current.type,
        items: [...res.items, ...newItemsToAdd],
      };
    });
    setError(null);
  }

  // AUTOMATIC COMPILATION: Whenever a matching active reservation is identified, automatically compile it!
  useEffect(() => {
    if (
      mode === "create" &&
      matchingActiveReservation &&
      compiledOrderId !== matchingActiveReservation.id &&
      ignoredMatchId !== matchingActiveReservation.id
    ) {
      handleCompileWithExisting(matchingActiveReservation);
    }
  }, [mode, matchingActiveReservation, compiledOrderId, ignoredMatchId]);

  // Reset compilation if customer name is changed away from matching reservation
  useEffect(() => {
    if (mode === "create" && compiledOrderId && !matchingActiveReservation) {
      setCompiledOrderId(null);
      setValues((current) => {
        const userEnteredItems = current.items.filter((it) => !it.isExistingFromCompiledOrder);
        return {
          ...current,
          invoiceNumber: "",
          items: userEnteredItems.length > 0 ? userEnteredItems : [createEmptyItem("fresh")],
        };
      });
    }
  }, [mode, compiledOrderId, matchingActiveReservation]);

  function handleUncompileReservation() {
    if (matchingActiveReservation) {
      setIgnoredMatchId(matchingActiveReservation.id);
    }
    setCompiledOrderId(null);

    setValues((current) => {
      const remainingNewItems = current.items.filter((it) => !it.isExistingFromCompiledOrder);
      return {
        ...current,
        invoiceNumber: "",
        items:
          remainingNewItems.length > 0
            ? remainingNewItems
            : [createEmptyItem("fresh")],
      };
    });
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
      type: formTypeToDb(values.type),
      orderSource: values.orderSource || null,
      compileTargetOrderId: compiledOrderId || undefined,
    };
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (isPending) return;

    for (let i = 0; i < values.items.length; i++) {
      const item = values.items[i];
      if (!item.itemName.trim()) {
        setError(`Item name is required for Item #${i + 1}.`);
        return;
      }
      const qty = parseNumber(item.quantity);
      if (!Number.isFinite(qty) || qty < 1) {
        setError(`Quantity must be at least 1 for Item #${i + 1}.`);
        return;
      }
      const price = parseNumber(item.price);
      if (!Number.isFinite(price) || price < 0) {
        setError(`Price cannot be negative for Item #${i + 1}.`);
        return;
      }
    }

    if (mode === "edit" || compiledOrderId) {
      const ok = await confirm({
        title: compiledOrderId ? "Compile with Existing Reservation" : "Save Reservation Changes",
        description: compiledOrderId
          ? `Compile these ${values.items.length} items into ${values.fbName || "this customer"}'s active reservation? This preserves previous records without separating.`
          : "Are you sure you want to save the changes to this reservation?",
        confirmLabel: compiledOrderId ? "Compile & Save" : "Save Changes",
        variant: "primary",
      });
      if (!ok) return;
    }

    const input = buildInput();

    startTransition(async () => {
      let result;
      if (compiledOrderId) {
        result = await updateReservation(compiledOrderId, input);
      } else if (mode === "create") {
        result = await createReservation(input);
      } else {
        result = await updateReservation(orderId ?? "", input);
      }

      if (result.ok) {
        let successMsg = "Reservation successfully created.";
        if (compiledOrderId) {
          successMsg = `Reservation successfully compiled into ${values.fbName || "the customer"}'s active order.`;
        } else if (mode === "edit") {
          successMsg = "Reservation changes successfully saved.";
        }
        onSuccess?.(successMsg);
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
    (mode === "create" && !compiledOrderId && editedDownpayment > 0) ||
    (mode === "edit" && editedDownpayment > originalDownpayment) ||
    (Boolean(compiledOrderId) && editedDownpayment > originalDownpayment);

  const isCompiled = Boolean(compiledOrderId);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 py-10"
      role="dialog"
      aria-modal="true"
      aria-label={mode === "create" ? (isCompiled ? "Compile Reservation" : "Add Reservation") : "Edit Reservation"}
      onClick={handleBackdropClick}
    >
      <div className="w-full max-w-4xl rounded-xl border border-white/10 bg-background shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-foreground">
              {mode === "create"
                ? isCompiled
                  ? "Compile Reservation Record"
                  : "Add Reservation"
                : "Edit Reservation"}
            </h2>
            {isCompiled ? (
              <span className="rounded-full bg-emerald-500/15 border border-emerald-500/25 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
                ⚡ Auto-Compiling with {values.fbName || "existing"} reservation
              </span>
            ) : null}
          </div>
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
          {/* Active Reservation Detection / Auto-Compilation Banner */}
          {mode === "create" && isCompiled && matchingActiveReservation ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.08] p-4 transition-all duration-200">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-emerald-500/20 p-2 shrink-0 text-emerald-400 mt-0.5">
                    <Check className="h-4 w-4" aria-hidden />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                        ⚡ Automatically Compiled with Active Reservation
                      </p>
                      <span className="rounded bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-foreground">
                        {matchingActiveReservation.items.length} previous item
                        {matchingActiveReservation.items.length === 1 ? "" : "s"} on file
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-foreground/90">
                      Previous items and customer details for <strong>{matchingActiveReservation.customerName}</strong>{" "}
                      {matchingActiveReservation.fbName ? `(@${matchingActiveReservation.fbName})` : ""} were automatically loaded.
                      Any new items will be saved directly into this reservation.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={handleUncompileReservation}
                    className="text-xs h-8 text-muted hover:text-foreground"
                  >
                    Separate as New Order Instead
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <h3 className={sectionHeadingClass}>Basic Information</h3>

            <div>
              <Label htmlFor={`${baseId}-fb-name`}>FB Name</Label>
              <Input
                id={`${baseId}-fb-name`}
                list={`${baseId}-active-fb-list`}
                value={values.fbName}
                onChange={(event) => update("fbName", event.target.value)}
                placeholder="e.g. Maria S."
                autoComplete="off"
              />
              <datalist id={`${baseId}-active-fb-list`}>
                {activeReservations
                  .filter((r) => r.fbName)
                  .map((r) => (
                    <option
                      key={r.id}
                      value={r.fbName!}
                      label={`Active reservation (${r.items.length} items)`}
                    />
                  ))}
              </datalist>
            </div>

            <div>
              <Label htmlFor={`${baseId}-type`}>Order Type</Label>
              <select
                id={`${baseId}-type`}
                value={values.type}
                onChange={(event) =>
                  update("type", event.target.value as ReservationTypeOption)
                }
                className={selectClass}
              >
                {RESERVATION_TYPE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor={`${baseId}-source`}>Order Source</Label>
              <select
                id={`${baseId}-source`}
                value={values.orderSource}
                onChange={(event) =>
                  update("orderSource", event.target.value as ReservationFormValues["orderSource"])
                }
                className={selectClass}
              >
                <option value="">Not set</option>
                <option value="live">Live</option>
                <option value="chat">Chat</option>
              </select>
            </div>

            <h3 className={`${sectionHeadingClass} mt-2`}>Shipping Information</h3>

            <div>
              <Label htmlFor={`${baseId}-customer-name`}>Customer Name</Label>
              <Input
                id={`${baseId}-customer-name`}
                list={`${baseId}-active-cust-list`}
                value={values.customerName}
                onChange={(event) => update("customerName", event.target.value)}
                placeholder="e.g. Maria Santos"
                autoComplete="off"
              />
              <datalist id={`${baseId}-active-cust-list`}>
                {activeReservations.map((r) => (
                  <option
                    key={r.id}
                    value={r.customerName}
                    label={`${r.fbName ? `@${r.fbName} · ` : ""}(${r.items.length} items)`}
                  />
                ))}
              </datalist>
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

          {/* Items Section */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] pb-2">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-pink-light">
                  Order Items ({values.items.length})
                </h3>
                {isCompiled ? (
                  <span className="text-[11px] text-muted">
                    · Includes previously reserved items + new items
                  </span>
                ) : null}
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
                    className={`relative rounded-xl border p-4 transition-all duration-200 ${
                      item.isExistingFromCompiledOrder
                        ? "border-white/15 bg-white/[0.035]"
                        : "border-white/10 bg-white/[0.02] hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-3 border-b border-white/5 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-pink-light">
                          Item #{index + 1}
                        </span>
                        {item.isExistingFromCompiledOrder ? (
                          <span className="inline-flex items-center gap-1 rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-muted">
                            <History className="h-3 w-3 text-pink-light/80" />
                            Previously Reserved
                          </span>
                        ) : isCompiled ? (
                          <span className="inline-flex items-center gap-1 rounded bg-pink-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-pink-light">
                            <Sparkles className="h-3 w-3" />
                            New Item
                          </span>
                        ) : null}
                      </div>

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

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12">
                      <div className="lg:col-span-2">
                        <Label htmlFor={`item-code-${item.id}`}>Code</Label>
                        <Input
                          id={`item-code-${item.id}`}
                          value={item.itemCode}
                          onChange={(e) => handleUpdateItem(index, "itemCode", e.target.value)}
                          placeholder="Optional"
                          autoComplete="off"
                        />
                      </div>

                      <div className="sm:col-span-2 lg:col-span-5">
                        <Label htmlFor={`item-name-${item.id}`}>Item Description</Label>
                        <Input
                          id={`item-name-${item.id}`}
                          value={item.itemName}
                          onChange={(e) => handleUpdateItem(index, "itemName", e.target.value)}
                          placeholder="e.g. 18k gold pearl necklace"
                          autoComplete="off"
                        />
                      </div>

                      <div className="lg:col-span-1">
                        <Label htmlFor={`item-qty-${item.id}`}>Qty</Label>
                        <Input
                          id={`item-qty-${item.id}`}
                          type="number"
                          min={1}
                          step={1}
                          value={item.quantity}
                          onChange={(e) => handleUpdateItem(index, "quantity", e.target.value)}
                        />
                      </div>

                      <div className="lg:col-span-2">
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

                      <div className="flex flex-col justify-end sm:col-span-2 lg:col-span-2">
                        <Label>Total</Label>
                        <div className="flex h-10 items-center justify-end rounded-lg border border-white/10 bg-white/[0.03] px-3 font-semibold text-pink-light text-sm">
                          {formatCurrency(itemTotal)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pricing & Financials */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <h3 className={sectionHeadingClass}>Pricing & Financials</h3>

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
              <Label htmlFor={`${baseId}-downpayment`}>
                {isCompiled ? "Total Downpayment" : "Downpayment"}
              </Label>
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

            <div>
              <Label htmlFor={`${baseId}-downpayment-method`}>
                Payment Method {needsDownpaymentMethod ? "*" : "(Optional)"}
              </Label>
              <select
                id={`${baseId}-downpayment-method`}
                value={values.downpaymentMethod}
                onChange={(event) => update("downpaymentMethod", event.target.value)}
                className={selectClass}
                required={needsDownpaymentMethod}
              >
                <option value="">Select method…</option>
                {PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
            </div>

          </div>

          {/* Order Totals Summary */}
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
              <div>
                <span className="text-muted">Items Subtotal: </span>
                <span className="font-semibold text-foreground">{formatCurrency(subtotal)}</span>
              </div>
              <div>
                <span className="text-muted">Discount: </span>
                <span className="font-semibold text-danger">-{formatCurrency(discount)}</span>
              </div>
              <div>
                <span className="text-muted">Shipping: </span>
                <span className="font-semibold text-foreground">{formatCurrency(shippingFee)}</span>
              </div>
              <div className="border-t border-white/10 pt-2 sm:border-t-0 sm:pt-0">
                <span className="text-muted">Grand Total: </span>
                <span className="text-base font-bold text-pink-light">{formatCurrency(grandTotal)}</span>
              </div>
            </div>
          </div>

          {error ? (
            <div
              role="alert"
              className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
            >
              {error}
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-3 border-t border-white/[0.07] pt-4">
            <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? "Saving…"
                : isCompiled
                ? "Compile & Save"
                : mode === "create"
                ? "Add Reservation"
                : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
