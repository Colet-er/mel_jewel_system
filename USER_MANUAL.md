# Daily Pearls PH — Order Management System (OMS) User Manual
**Version 2.5 — Standard Operating Procedure & User Handbook**

---

## Quick Navigation
1. [Role-Based Access Control (RBAC) Matrix](#1-role-based-access-control-rbac-matrix)
2. [Searchable Jewelry Catalog Combobox](#2-searchable-jewelry-catalog-combobox)
3. [Automatic Repeat Customer Compilation](#3-automatic-repeat-customer-compilation)
4. [Creating a Reservation (Step-by-Step)](#4-creating-a-reservation-step-by-step)
5. [Order Lifecycle & Status Pipeline](#5-order-lifecycle--status-pipeline)
6. [Payment Processing & Proof Receipts](#6-payment-processing--proof-receipts)
7. [Shipping, Delivery & RTO Handling](#7-shipping-delivery--rto-handling)
8. [Digital Invoices & 1-Click Social Templates](#8-digital-invoices--1-click-social-templates)
9. [Moissanite Luxury Jewelry Inventory](#9-moissanite-luxury-jewelry-inventory)
10. [Employee Commission Tracking (Developer & Owner Only)](#10-employee-commission-tracking-developer--owner-only)
11. [Financial Reports & Analytics (Developer & Owner Only)](#11-financial-reports--analytics-developer--owner-only)
12. [Frequently Asked Questions (FAQ)](#12-frequently-asked-questions-faq)

---

## 1. Role-Based Access Control (RBAC) Matrix

| Module / Feature | Developer | Owner | Admin | Staff | Viewer |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Orders & Reservations** (Create, Edit, Status, Delete) | ✅ Full | ✅ Full | ✅ Full | ✅ Full | ❌ No Access |
| **Record Payments & Receipts** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | ❌ No Access |
| **Ship, Claim, RTO & Reship** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | ❌ No Access |
| **Jewelry Catalog & Moissanite SKUs** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | 👁️ Read-Only |
| **Customer Database** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | ❌ No Access |
| **Collections Ledger** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | ❌ No Access |
| **Commission & Payout Tracking** (`/commission`) | ✅ Full | ✅ Full | ❌ **No Access** | ❌ **No Access** | ❌ No Access |
| **Financial & Sales Reports** (`/reports`) | ✅ Full | ✅ Full | ❌ **No Access** | ❌ **No Access** | ❌ No Access |
| **User Account Management** (`/accounts`) | ✅ Full | ✅ Full | ❌ **No Access** | ❌ No Access | ❌ No Access |

> **Security & Financial Confidentiality Rule**: Only **Developer** and **Owner** accounts can access **User Account Management** (`/accounts`), **Commission Tracking** (`/commission`), and **Financial Reports** (`/reports`). Admin and Staff accounts are strictly restricted from user credentials, commissions, profit margins, and financial reports.

---

## 2. Searchable Jewelry Catalog Combobox

Selecting items during fast-paced live selling sessions is effortless:
1. In the reservation form, choose **Jewelry** or **Moissanite**.
2. Click **Select catalog item...** to open the search bar.
3. Type any keyword (e.g. `SSP-01`, `Solitaire`, `Ring`). The list filters in real time.
4. Press <kbd>Enter</kbd> or click the item to auto-populate SKU, name, category, and unit price.

---

## 3. Automatic Repeat Customer Compilation

When repeat buyers claim multiple pieces at different times during a live selling session:
1. Open **Add Reservation** and start typing the customer's **FB Name** or **Customer Name**.
2. The system **automatically detects active open reservations** (`status = "reserved"`).
3. All previous line items are loaded into the form.
4. Click **+ Add Item** to append the new claim.
5. Click **Save Reservation**. The system compiles the items onto the existing invoice without creating duplicate orders.

---

## 4. Creating a Reservation (Step-by-Step)

1. **Order Type**: Choose `Regular` (standard live selling), `Pasabuy` (custom mounts), or `COD`.
2. **Customer Information**: Enter FB Name, Customer Name, Contact Number, and Delivery Address.
3. **Add Items**: Select from catalog or manually type custom items, quantities, and prices.
4. **Discounts & Shipping**: Enter agreed discount and courier shipping fee.
5. **Downpayment (DP)**: Enter initial deposit and choose payment method (GCash, BDO, BPI, Maya, Cash).
6. **Save**: Click **Save Reservation**. Click the customer's FB name in any table to open the invoice.

---

## 5. Order Lifecycle & Status Pipeline

`Reserved (Held)` ➔ `Paid (Settled)` ➔ `Shipped (In Transit)` ➔ `Claimed (Delivered)`

- **Reserved** (`/orders/reserved`): Items held awaiting balance payment or dispatch.
- **Paid** (`/orders/paid`): Fully paid and ready for packing.
- **Shipped** (`/orders/shipped`): Package handed over to courier with tracking number.
- **Claimed** (`/orders/claimed`): Package received by customer. Transaction closed.
- **RTO (Return to Origin)** (`/orders/rto`): Delivery failed. Can be reshipped with a new tracking number.
- **Cancelled** (`/orders/cancelled`): Order voided prior to dispatch.

---

## 6. Payment Processing & Proof Receipts

1. Open the order and click **Record Payment**.
2. Select **Kind**: `Downpayment` (initial deposit) or `Balance` (settling balance).
3. Choose **Payment Method**: GCash, Maya, BDO, BPI, UnionBank, Cash, or COD.
4. Enter **Amount** and **Reference Number**.
5. Attach receipt screenshots (`.png`, `.jpg`, `.pdf`).
6. Click **Save Payment**.

---

## 7. Shipping, Delivery & RTO Handling

- **Ship Order**: Click **Ship Order**, select courier (LBC, J&T, Flash, Grab/Lalamove), and enter the Tracking Number.
- **Mark Claimed**: Once courier confirms delivery, click **Mark Claimed**.
- **Handle RTO**: If delivery fails, click **Mark as RTO** and specify reason.
- **Reship Order**: Under **Orders > RTO**, click **Reship Order** to assign a new tracking number.

---

## 8. Digital Invoices & 1-Click Social Templates

Located at `/orders/[id]/invoice`:
- **Printable Invoice**: Official branding, itemized table, payment history, and receipt thumbnails. Press <kbd>Ctrl + P</kbd> to print.
- **1-Click Message Copy**: Click **COPY INVOICE**, **COPY REGULAR**, **COPY PASABUY**, or **COPY COD** to copy pre-formatted chat summaries ready to paste into Facebook Messenger or Instagram DMs.

---

## 9. Moissanite Luxury Jewelry Inventory

- **SKU Catalog** (`/moissanite/sku`): Manage stone cuts, settings (Solitaire, Halo, 6-Prong, Pavé), carat sizes, cost prices, and retail prices.

---

## 10. Employee Commission Tracking (Developer & Owner Only)

Located at `/commission`:
1. Click **+ Add Record**.
2. Select the related order or enter live selling assistance details.
3. Select employee name and enter Commission Amount (PHP).
4. Filter by `Unpaid` to view pending payouts and click **Mark as Paid** upon disbursement.

---

## 11. Financial Reports & Analytics (Developer & Owner Only)

Located at `/reports`:
- Monthly gross revenue, discounts, shipping fees, and net profit.
- Fulfillment statistics and RTO ratios.
- **Export to CSV**: Export all table data into Microsoft Excel or Google Sheets.

---

## 12. Frequently Asked Questions (FAQ)

**Q: What if a customer claims items at different times during a live stream?**  
> Type their name in Add Reservation. The system automatically loads their active order so you can add new items to the same invoice.

**Q: Can I record multiple payments for the same order?**  
> Yes. Use **Record Payment** as many times as needed (e.g. ₱500 GCash deposit + ₱2,500 BDO balance).

**Q: Why are Commission and Reports hidden for Admin and Staff?**  
> To ensure strict financial confidentiality, only Developer and Owner roles can view company financial reports and employee commission payouts.
