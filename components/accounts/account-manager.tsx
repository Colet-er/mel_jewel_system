"use client";

import { useState, useTransition, useMemo, useRef, useEffect, type FormEvent } from "react";
import { createPortal } from "react-dom";
import {
  KeyRound,
  Pencil,
  Plus,
  Trash2,
  X,
  Users,
  History,
  Search,
  ArrowRight,
  Shield,
  UserCheck,
  Clock,
  Filter,
  MoreHorizontal,
} from "lucide-react";
import {
  createAccount,
  deleteAccount,
  resetAccountPassword,
  updateAccountCredentials,
  updateAccountRole,
} from "@/app/(dashboard)/accounts/actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { RoleBadge } from "@/components/ui/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";
import type { UserRole } from "@/types";

export interface ManagedAccount {
  id: string;
  email: string;
  fullName: string | null;
  role: UserRole;
  createdAt: string;
  confirmedAt: string;
  lastSignInAt: string;
}

export interface ActivityLogItem {
  id: string;
  orderId: string;
  orderCode: string;
  customerName: string | null;
  fromStatus: string | null;
  toStatus: string;
  notes: string | null;
  createdAt: string;
  rawCreatedAt: string;
  changedBy: {
    id: string;
    fullName: string | null;
    email: string | null;
    role: string | null;
  } | null;
}

interface AccountManagerProps {
  accounts: ManagedAccount[];
  activityLogs: ActivityLogItem[];
  currentUserId: string;
  currentUserRole: string;
  isDeveloper: boolean;
  serviceRoleConfigured?: boolean;
}

type Message = { kind: "success" | "error"; text: string };

export function AccountManager({
  accounts,
  activityLogs,
  currentUserId,
  currentUserRole,
  isDeveloper,
  serviceRoleConfigured = true,
}: AccountManagerProps) {
  const [activeTab, setActiveTab] = useState<"users" | "logs">("users");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<Message | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [logSearch, setLogSearch] = useState("");
  const [logStatusFilter, setLogStatusFilter] = useState("all");
  const [editingAccount, setEditingAccount] = useState<ManagedAccount | null>(null);

  function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setMessage(null);
    startTransition(async () => {
      const result = await createAccount({
        email: String(form.get("email") ?? ""),
        fullName: String(form.get("fullName") ?? ""),
        password: String(form.get("password") ?? ""),
        role: String(form.get("role") ?? "viewer") as ManagedAccount["role"],
      });
      setMessage({
        kind: result.success ? "success" : "error",
        text: result.success ? "User account created successfully." : result.error ?? "Account creation failed.",
      });
      if (result.success) {
        formElement.reset();
        setShowCreateForm(false);
      }
    });
  }

  const filteredAccounts = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter(
      (acc) =>
        acc.email.toLowerCase().includes(q) ||
        (acc.fullName && acc.fullName.toLowerCase().includes(q)) ||
        acc.role.toLowerCase().includes(q)
    );
  }, [accounts, userSearch]);

  const filteredLogs = useMemo(() => {
    let list = activityLogs;
    if (logStatusFilter !== "all") {
      list = list.filter((log) => log.toStatus === logStatusFilter);
    }
    const q = logSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (log) =>
        log.orderCode.toLowerCase().includes(q) ||
        (log.customerName && log.customerName.toLowerCase().includes(q)) ||
        (log.notes && log.notes.toLowerCase().includes(q)) ||
        (log.changedBy?.fullName && log.changedBy.fullName.toLowerCase().includes(q)) ||
        (log.changedBy?.email && log.changedBy.email.toLowerCase().includes(q)) ||
        (log.fromStatus && log.fromStatus.toLowerCase().includes(q)) ||
        log.toStatus.toLowerCase().includes(q)
    );
  }, [activityLogs, logStatusFilter, logSearch]);

  return (
    <div className="space-y-6">
      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("users")}
            className={cn(
              "flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all",
              activeTab === "users"
                ? "bg-primary text-white shadow-lg shadow-primary/25"
                : "text-muted hover:bg-white/[0.05] hover:text-foreground"
            )}
          >
            <Users className="h-4 w-4" />
            <span>User Accounts</span>
            <span
              className={cn(
                "ml-1 rounded-full px-2 py-0.5 text-xs font-bold",
                activeTab === "users" ? "bg-white/20 text-white" : "bg-elevated text-muted"
              )}
            >
              {accounts.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("logs")}
            className={cn(
              "flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all",
              activeTab === "logs"
                ? "bg-primary text-white shadow-lg shadow-primary/25"
                : "text-muted hover:bg-white/[0.05] hover:text-foreground"
            )}
          >
            <History className="h-4 w-4" />
            <span>Activity Logs</span>
            <span
              className={cn(
                "ml-1 rounded-full px-2 py-0.5 text-xs font-bold",
                activeTab === "logs" ? "bg-white/20 text-white" : "bg-elevated text-muted"
              )}
            >
              {activityLogs.length}
            </span>
          </button>
        </div>

        {activeTab === "users" && (
          <Button
            type="button"
            variant={showCreateForm ? "secondary" : "primary"}
            size="sm"
            onClick={() => setShowCreateForm((prev) => !prev)}
            className="gap-1.5"
          >
            {showCreateForm ? (
              <>
                <X className="h-4 w-4" /> Cancel
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" /> Add New User
              </>
            )}
          </Button>
        )}
      </div>

      {!serviceRoleConfigured && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200 shadow-lg">
          <div className="flex items-start gap-3">
            <Shield className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <div className="space-y-1 text-xs sm:text-sm">
              <p className="font-semibold text-amber-300">
                Setup Note: SUPABASE_SERVICE_ROLE_KEY is not yet added to your environment (.env.local)
              </p>
              <p className="text-amber-200/90">
                Existing profiles and activity logs are loaded in standard mode. To enable creating new users, editing credentials, and resetting passwords directly from this page, add your service role secret key to <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-amber-300">.env.local</code>:
              </p>
              <p className="mt-1 font-mono text-[11px] text-amber-300">
                SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_secret_key
              </p>
              <p className="text-[11px] text-amber-200/70">
                (You can find this in your Supabase Dashboard &rarr; Project Settings &rarr; API &rarr; <code className="font-mono">service_role</code> secret key).
              </p>
            </div>
          </div>
        </div>
      )}

      {message ? (
        <div
          role="status"
          className={cn(
            "flex items-center justify-between rounded-xl border p-4 text-sm font-medium",
            message.kind === "success"
              ? "border-success/30 bg-success/10 text-success"
              : "border-danger/30 bg-danger/10 text-danger"
          )}
        >
          <span>{message.text}</span>
          <button
            type="button"
            onClick={() => setMessage(null)}
            className="ml-3 rounded p-1 hover:bg-white/10"
            aria-label="Dismiss message"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {/* TAB 1: USER ACCOUNTS */}
      {activeTab === "users" && (
        <div className="space-y-6">
          {/* Create User Collapsible Card */}
          {showCreateForm && (
            <Card className="border-primary/30 bg-gradient-to-br from-card to-primary/[0.03] shadow-xl">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base text-primary">
                  <UserCheck className="h-5 w-5" />
                  Create New System User
                </CardTitle>
                <CardDescription>
                  Enter full name, email, role, and temporary password to create a login account.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={submitCreate} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <Label htmlFor="account-name">Full Name</Label>
                      <Input
                        id="account-name"
                        name="fullName"
                        placeholder="e.g. Jane Doe"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="account-email">Email Address</Label>
                      <Input
                        id="account-email"
                        name="email"
                        type="email"
                        placeholder="jane@meljewel.com"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="account-password">Temporary Password</Label>
                      <Input
                        id="account-password"
                        name="password"
                        type="password"
                        placeholder="Min 8 characters"
                        minLength={8}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="account-role">Access Role</Label>
                      <select
                        id="account-role"
                        name="role"
                        defaultValue="staff"
                        className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="owner">Owner (Full Business Control)</option>
                        <option value="admin">Admin (System Administration)</option>
                        <option value="staff">Staff (Orders & Inventory)</option>
                        <option value="viewer">Viewer (Read-Only)</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setShowCreateForm(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={pending}>
                      {pending ? "Creating..." : "Create User Account"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* User Search & Filter */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search accounts by name, email, or role..."
                className="pl-10"
              />
            </div>
          </div>

          {/* User Table */}
          <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-card/60 backdrop-blur-sm [scrollbar-gutter:stable]">
            <table className="w-full min-w-full text-left text-xs sm:text-sm">
              <thead className="border-b border-white/[0.08] bg-white/[0.02]">
                <tr>
                  {[
                    "User",
                    "Role",
                    "Created",
                    "Email Status",
                    "Last Sign-In",
                    "Actions",
                  ].map((heading) => (
                    <th
                      key={heading}
                      className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filteredAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-muted">
                      No accounts found matching your search.
                    </td>
                  </tr>
                ) : (
                  filteredAccounts.map((account) => (
                    <AccountRow
                      key={account.id}
                      account={account}
                      isCurrent={account.id === currentUserId}
                      pending={pending}
                      run={startTransition}
                      report={setMessage}
                      onEdit={() => setEditingAccount(account)}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: ACTIVITY LOGS */}
      {activeTab === "logs" && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/[0.08] bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Total Events</p>
              <p className="mt-2 text-2xl font-bold text-foreground">{activityLogs.length}</p>
              <p className="mt-1 text-xs text-muted">Order transitions and system logs recorded</p>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Active Users</p>
              <p className="mt-2 text-2xl font-bold text-primary">{accounts.length}</p>
              <p className="mt-1 text-xs text-muted">Configured accounts in system</p>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Role Permission</p>
              <p className="mt-2 text-2xl font-bold uppercase text-emerald-400">
                {currentUserRole}
              </p>
              <p className="mt-1 text-xs text-muted">
                {isDeveloper ? "Developer Admin Mode" : "Full Management Privileges"}
              </p>
            </div>
          </div>

          {/* Search and Filters for Logs */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                placeholder="Search activity logs by order #, customer, user, or notes..."
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted" />
              <select
                value={logStatusFilter}
                onChange={(e) => setLogStatusFilter(e.target.value)}
                className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="all">All Event Types</option>
                <option value="reserved">Reserved</option>
                <option value="paid">Paid</option>
                <option value="shipped">Shipped</option>
                <option value="claimed">Claimed</option>
                <option value="rto">RTO</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Activity Logs Table */}
          <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-card/60 backdrop-blur-sm [scrollbar-gutter:stable]">
            <table className="w-full min-w-full text-left text-xs sm:text-sm">
              <thead className="border-b border-white/[0.08] bg-white/[0.02]">
                <tr>
                  {[
                    "Timestamp",
                    "Order Code",
                    "Customer",
                    "Status Transition",
                    "Action By",
                    "Notes / Details",
                  ].map((heading) => (
                    <th
                      key={heading}
                      className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-muted">
                      No activity logs match the selected criteria.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="transition-colors hover:bg-white/[0.02]">
                      <td className="whitespace-nowrap px-4 py-3.5 text-xs text-muted">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-muted/70" />
                          <span suppressHydrationWarning>{log.createdAt}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs font-semibold text-primary">
                        {log.orderCode}
                      </td>
                      <td className="px-4 py-3.5 text-foreground">
                        {log.customerName || <span className="text-muted italic">None</span>}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={log.fromStatus || "new"} />
                          <ArrowRight className="h-3.5 w-3.5 text-muted" />
                          <StatusBadge status={log.toStatus} />
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        {log.changedBy ? (
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-foreground">
                                {log.changedBy.fullName || log.changedBy.email || "User"}
                              </span>
                              {log.changedBy.role && (
                                <RoleBadge role={log.changedBy.role as UserRole} />
                              )}
                            </div>
                            {log.changedBy.email && log.changedBy.fullName && (
                              <span className="text-[11px] text-muted">{log.changedBy.email}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs italic text-muted">System / Auto</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-muted">
                        {log.notes ? (
                          <span className="rounded-md bg-elevated px-2 py-1 text-foreground/90">
                            {log.notes}
                          </span>
                        ) : (
                          <span className="text-muted/60">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Floating Modal for Editing User Credentials (Completely Outside Table) */}
      {editingAccount && (
        <EditAccountModal
          account={editingAccount}
          onClose={() => setEditingAccount(null)}
          pending={pending}
          run={startTransition}
          report={setMessage}
        />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    reserved: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    paid: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    shipped: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    claimed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    rto: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    cancelled: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    new: "bg-white/5 text-muted border-white/10",
  };

  const style = styles[status.toLowerCase()] ?? "bg-elevated text-muted border-white/10";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider",
        style
      )}
    >
      {status}
    </span>
  );
}

function AccountRow({
  account,
  isCurrent,
  pending,
  run,
  report,
  onEdit,
}: {
  account: ManagedAccount;
  isCurrent: boolean;
  pending: boolean;
  run: (callback: () => Promise<void>) => void;
  report: (message: Message) => void;
  onEdit: () => void;
}) {
  const [role, setRole] = useState(account.role);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        menuButtonRef.current &&
        !menuButtonRef.current.contains(event.target as Node)
      ) {
        setMenuOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    function handleScroll() {
      setMenuOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [menuOpen]);

  function toggleMenu() {
    if (menuButtonRef.current) {
      const rect = menuButtonRef.current.getBoundingClientRect();
      const menuWidth = 180;
      setMenuPos({
        top: rect.bottom + 6,
        left: Math.max(10, rect.right - menuWidth),
      });
    }
    setMenuOpen((prev) => !prev);
  }

  function saveRole() {
    run(async () => {
      const result = await updateAccountRole(account.id, role);
      report({
        kind: result.success ? "success" : "error",
        text: result.success ? `Updated role for ${account.email}.` : result.error ?? "Role update failed.",
      });
    });
  }

  function resetPassword() {
    setMenuOpen(false);
    const password = window.prompt(
      `Enter a new password for ${account.email} (minimum 8 characters):`
    );
    if (!password) return;
    run(async () => {
      const result = await resetAccountPassword(account.id, password);
      report({
        kind: result.success ? "success" : "error",
        text: result.success
          ? `Password updated for ${account.email}.`
          : result.error ?? "Password reset failed.",
      });
    });
  }

  function removeAccount() {
    setMenuOpen(false);
    if (
      !window.confirm(
        `Are you sure you want to permanently delete ${account.email}? This action cannot be undone.`
      )
    )
      return;
    run(async () => {
      const result = await deleteAccount(account.id);
      report({
        kind: result.success ? "success" : "error",
        text: result.success ? "Account deleted." : result.error ?? "Account deletion failed.",
      });
    });
  }

  const initials = (account.fullName || account.email)
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <tr className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
      <td className="px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/30 to-primary/10 text-xs font-bold text-pink-light ring-1 ring-white/10">
            {initials || "U"}
          </div>
          <div>
            <p className="font-semibold text-foreground">
              {account.fullName || "Unnamed user"}
              {isCurrent && (
                <span className="ml-1.5 rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-bold text-pink-light">
                  You
                </span>
              )}
            </p>
            <p className="text-xs text-muted">{account.email}</p>
            <p className="mt-0.5 font-mono text-[10px] text-muted/60">{account.id}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-4">
        <div className="flex items-center gap-2">
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as ManagedAccount["role"])}
            className="h-8 rounded-lg border border-border bg-background px-2 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
          >
            <option value="owner">Owner</option>
            <option value="admin">Admin</option>
            <option value="staff">Staff</option>
            <option value="viewer">Viewer</option>
          </select>
          <RoleBadge role={account.role} />
          {role !== account.role && (
            <Button
              size="sm"
              variant="primary"
              disabled={pending}
              onClick={saveRole}
              className="h-7 px-2 text-xs"
            >
              Save
            </Button>
          )}
        </div>
      </td>
      <td suppressHydrationWarning className="px-4 py-4 text-xs text-muted">{account.createdAt}</td>
      <td className="px-4 py-4 text-xs text-muted">
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
            account.confirmedAt === "Pending"
              ? "bg-amber-500/10 text-amber-400"
              : "bg-emerald-500/10 text-emerald-400"
          )}
        >
          {account.confirmedAt}
        </span>
      </td>
      <td suppressHydrationWarning className="px-4 py-4 text-xs text-muted">{account.lastSignInAt}</td>
      <td className="px-4 py-4">
        <div className="relative inline-flex items-center gap-1.5">
          {/* Floating Edit Action Button */}
          <Button
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={onEdit}
            className="h-8 gap-1.5 rounded-lg px-3 text-xs font-medium shadow-sm transition-all hover:border-primary/40 hover:shadow-primary/10"
          >
            <Pencil className="h-3.5 w-3.5 text-primary" aria-hidden />
            Edit
          </Button>

          {/* Floating Dropdown Menu Trigger */}
          <button
            ref={menuButtonRef}
            type="button"
            onClick={toggleMenu}
            disabled={pending}
            aria-label="Account actions menu"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-elevated/60 text-muted transition-colors hover:bg-elevated hover:text-foreground disabled:opacity-50"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>

          {/* Floating Action Portal Dropdown */}
          {menuOpen &&
            menuPos &&
            typeof document !== "undefined" &&
            createPortal(
              <div
                ref={menuRef}
                style={{ top: `${menuPos.top}px`, left: `${menuPos.left}px` }}
                className="fixed z-50 min-w-[180px] rounded-xl border border-white/10 bg-card/95 p-1.5 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100"
              >
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onEdit();
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-foreground transition-colors hover:bg-white/10"
                >
                  <Pencil className="h-3.5 w-3.5 text-primary" />
                  <span>Edit Credentials</span>
                </button>

                <button
                  type="button"
                  onClick={resetPassword}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-foreground transition-colors hover:bg-white/10"
                >
                  <KeyRound className="h-3.5 w-3.5 text-amber-400" />
                  <span>Reset Password</span>
                </button>

                {!isCurrent && (
                  <button
                    type="button"
                    onClick={removeAccount}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-danger transition-colors hover:bg-danger/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete User</span>
                  </button>
                )}
              </div>,
              document.body
            )}
        </div>
      </td>
    </tr>
  );
}

/**
 * Floating Modal rendered completely outside the table hierarchy
 */
function EditAccountModal({
  account,
  onClose,
  pending,
  run,
  report,
}: {
  account: ManagedAccount;
  onClose: () => void;
  pending: boolean;
  run: (callback: () => Promise<void>) => void;
  report: (message: Message) => void;
}) {
  const [role, setRole] = useState<UserRole>(account.role);

  function saveCredentials(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get("password") ?? "").trim();
    const newRole = String(form.get("role") ?? role) as UserRole;

    run(async () => {
      const result = await updateAccountCredentials({
        accountId: account.id,
        email: String(form.get("email") ?? ""),
        fullName: String(form.get("fullName") ?? ""),
        password: newPassword.length > 0 ? newPassword : undefined,
        role: newRole,
      });
      report({
        kind: result.success ? "success" : "error",
        text: result.success
          ? `User credentials for ${account.email} updated successfully.`
          : result.error ?? "Credential update failed.",
      });
      if (result.success) {
        onClose();
      }
    });
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-md animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`edit-account-title-${account.id}`}
        className="w-full max-w-lg rounded-2xl border border-white/15 bg-card/95 p-6 shadow-2xl ring-1 ring-white/10 backdrop-blur-xl animate-in zoom-in-95 duration-150"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2
              id={`edit-account-title-${account.id}`}
              className="text-lg font-semibold text-foreground"
            >
              Edit User Credentials
            </h2>
            <p className="mt-1 text-xs text-muted">
              Update full name, login email, role, or assign a new password.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            aria-label="Close modal"
            className="rounded-lg p-2 text-muted transition-colors hover:bg-elevated hover:text-foreground disabled:opacity-50"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <form onSubmit={saveCredentials} className="space-y-4">
          <div>
            <Label htmlFor={`modal-edit-name-${account.id}`}>Full Name</Label>
            <Input
              id={`modal-edit-name-${account.id}`}
              name="fullName"
              defaultValue={account.fullName ?? ""}
              required
            />
          </div>

          <div>
            <Label htmlFor={`modal-edit-email-${account.id}`}>Login Email</Label>
            <Input
              id={`modal-edit-email-${account.id}`}
              name="email"
              type="email"
              defaultValue={account.email}
              required
            />
          </div>

          <div>
            <Label htmlFor={`modal-edit-role-${account.id}`}>Access Role</Label>
            <select
              id={`modal-edit-role-${account.id}`}
              name="role"
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="owner">Owner (Full Business Control)</option>
              <option value="admin">Admin (System Administration)</option>
              <option value="staff">Staff (Orders & Inventory)</option>
              <option value="viewer">Viewer (Read-Only)</option>
            </select>
          </div>

          <div>
            <Label htmlFor={`modal-edit-password-${account.id}`}>
              New Password <span className="text-xs font-normal text-muted">(optional)</span>
            </Label>
            <Input
              id={`modal-edit-password-${account.id}`}
              name="password"
              type="password"
              placeholder="Leave blank to keep current password"
              minLength={8}
            />
            <p className="mt-1 text-[11px] text-muted">
              Only fill this in if you want to reset the user&apos;s password (min 8 chars).
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving Changes..." : "Save Credentials"}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
