"use client";

import { useMemo, useState } from "react";
import { Info, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils/format";

interface CustomerOption {
  id: string;
  name: string;
}

interface ProductOption {
  id: string;
  name: string;
  price: number;
}

interface LineRow {
  key: number;
  productId: string;
  quantity: string;
}

interface NewOrderFormProps {
  customers: CustomerOption[];
  products: ProductOption[];
}

let nextKey = 1;

export function NewOrderForm({ customers, products }: NewOrderFormProps) {
  const [customerId, setCustomerId] = useState("");
  const [rows, setRows] = useState<LineRow[]>([{ key: nextKey++, productId: "", quantity: "1" }]);
  const [notice, setNotice] = useState(false);

  const productById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products]
  );

  const total = rows.reduce((sum, row) => {
    const price = productById.get(row.productId)?.price ?? 0;
    return sum + price * (Number.parseInt(row.quantity, 10) || 0);
  }, 0);

  const selectClass =
    "h-10 w-full rounded-lg border border-white/10 bg-background/55 px-3 text-sm text-foreground shadow-inner shadow-black/5 transition-all duration-200 hover:border-white/20 focus:border-primary focus:bg-background/80 focus:ring-4 focus:ring-primary/10";

  if (customers.length === 0 || products.length === 0) {
    return (
      <p className="rounded-lg border border-white/10 bg-elevated/60 px-4 py-3 text-sm text-muted">
        {customers.length === 0
          ? "Add at least one customer before creating an order."
          : "Add at least one active product before creating an order."}
      </p>
    );
  }

  function updateRow(key: number, patch: Partial<LineRow>) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row))
    );
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setNotice(true);
      }}
      className="space-y-6"
    >
      <div className="max-w-md">
        <Label htmlFor="customer">Customer</Label>
        <select
          id="customer"
          value={customerId}
          onChange={(event) => setCustomerId(event.target.value)}
          className={selectClass}
        >
          <option value="">Select a customer…</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-3">
        <Label>Items</Label>
        {rows.map((row) => (
          <div key={row.key} className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select
              aria-label="Product"
              value={row.productId}
              onChange={(event) => updateRow(row.key, { productId: event.target.value })}
              className={`${selectClass} sm:max-w-xs`}
            >
              <option value="">Select a product…</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} — {formatCurrency(product.price)}
                </option>
              ))}
            </select>
            <Input
              type="number"
              min={1}
              aria-label="Quantity"
              value={row.quantity}
              onChange={(event) => updateRow(row.key, { quantity: event.target.value })}
              className="sm:w-24"
            />
            <button
              type="button"
              onClick={() => setRows((current) => current.filter((r) => r.key !== row.key))}
              disabled={rows.length === 1}
              aria-label="Remove item"
              className="self-start rounded-lg p-2 text-muted transition-colors hover:text-danger disabled:pointer-events-none disabled:opacity-40"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ))}
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setRows((current) => [...current, { key: nextKey++, productId: "", quantity: "1" }])}
        >
          <Plus className="h-4 w-4" aria-hidden />
          Add item
        </Button>
      </div>

      <div className="flex items-center justify-between border-t border-white/[0.07] pt-4">
        <p className="text-sm font-medium text-muted">Order total</p>
        <p className="text-lg font-semibold text-pink-light">{formatCurrency(total)}</p>
      </div>

      {notice ? (
        <p
          role="status"
          className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-pink-light"
        >
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          Order creation will be enabled once the order workflow is finalized. No data was saved.
        </p>
      ) : null}

      <Button type="submit" size="lg">
        Create order
      </Button>
    </form>
  );
}
