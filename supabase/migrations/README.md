# Supabase migration audit

The linked project currently has an empty `supabase_migrations.schema_migrations`
history even though its `public` schema contains legacy production objects.
After an object-by-object audit and explicit approval, migrations whose complete
effects are supplied by the retained domain/reconciliation migrations were
removed. Migration `0014` remains the authoritative, non-destructive
reconciliation layer. Numbering gaps are intentional.

## Classification

| Migration | Classification | Reason |
| --- | --- | --- |
| `0001_foundation.sql` | KEEP | Owns profiles, roles, Auth trigger, role helpers, and profile RLS. |
| `0002_orders_domain.sql` | KEEP | Complete clean-install customer, category, product, order, item, lifecycle, archive, discount, shipping, and RLS baseline. |
| `0003_downpayments.sql` | KEEP | Complete payment ledger and evidence-metadata baseline, payment helpers, and unchanged payment RLS model. |
| `0004_reservation_actions.sql` | SHOULD CONSOLIDATE | Owns status history and the original paid transition; `0014` supersedes only the paid implementation. Retained so clean installs still create history before later RPCs. |
| `0005_reservation_form.sql` | REMOVED — SUPERSEDED | Address/type columns are in `0002`; cancellation is superseded by `0007`; the destructive downpayment writer is removed. |
| `0006_reservation_form_fields.sql` | REMOVED — DUPLICATE | Discount is already part of `0002` and reconciled by `0014`. |
| `0007_invoice_status_fields.sql` | KEEP | Owns invoice-number trigger plus final cancel/shipped lifecycle RPCs and history timestamps. |
| `0008_shipping_fee.sql` | REMOVED — DUPLICATE | Shipping fee is already part of `0002` and reconciled by `0014`. |
| `0009_product_code_compat.sql` | REMOVED — SUPERSEDED | SKU/product-code compatibility and backfill are covered by `0002` plus `0014`. |
| `0010_product_name_compat.sql` | REMOVED — SUPERSEDED | Canonical product name and legacy backfill are covered by `0002` plus `0014`. |
| `0011_create_reservation_rpc.sql` | REMOVED — SUPERSEDED | Replaced by the category/payment-method-aware atomic RPC in `0014`. |
| `0012_fix_create_reservation_rpc.sql` | REMOVED — SUPERSEDED | Temporary compatibility implementation replaced by `0014`. |
| `0013_payment_evidence_bucket.sql` | KEEP | Owns the private five-megabyte JPEG/PNG/WebP Storage bucket and existing Storage policies. |
| `0014_reconcile_reservation_payment_domains.sql` | KEEP | Authoritative production reconciliation, canonical backfills, and final create/edit/payment/paid RPCs. |

## Canonical application contract

- Invoice identifier: `orders.order_number`. `order_no` is legacy-only and is
  copied during reconciliation; application code does not use it.
- Archive behavior: `orders.archived_at` for reservations and `is_archived` for
  customer/product lookup compatibility.
- Payment method: `order_payments.payment_method`, required and restricted to
  Cash, GCash, Maya, Bank Transfer, COD, or Other.
- Payment reference: `order_payments.reference_number`. Legacy `reference` and
  `reference_no` are copied during reconciliation.
- Payment totals and balances are derived from `order_payments`; they are not
  duplicated on `orders`.
- Item subtotal is derived from `order_items.line_total`; shipping and discount
  are stored once on `orders`.

## Safe future squash procedure

Before any further squash or migration-history rewrite, require all of the
following:

1. A clean database has successfully applied the proposed shortened chain.
2. Reservation create/edit/cancel/paid/shipped/invoice and payment evidence have
   been integration-tested against that clean database.
3. The linked project's migration history has been baselined or repaired to the
   same versions without changing existing customer, order, item, or payment data.
4. A database backup has been taken before changing recorded migration history.

The retained migrations still own all workflow functions, RLS objects, evidence
storage, and the final reconciliation contract.
