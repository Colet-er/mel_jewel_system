import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export function UnauthorizedState() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div
        role="alert"
        className="w-full max-w-md rounded-xl border border-white/[0.07] bg-card p-6 text-center sm:p-8"
      >
        <ShieldAlert aria-hidden className="mx-auto h-10 w-10 text-primary" />
        <h1 className="mt-4 text-lg font-semibold text-foreground">Sign in required</h1>
        <p className="mt-2 text-sm text-muted">
          You are not signed in, or your session has expired. Please sign in to access the
          dashboard.
        </p>
        <Link href="/login" className={buttonVariants({ className: "mt-6 w-full justify-center" })}>
          Go to sign in
        </Link>
      </div>
    </main>
  );
}
