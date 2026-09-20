import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { LoginForm, LoginBrand } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Developer Portal | Order Management",
};

export default function DeveloperLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <LoginBrand />
        </div>
        <div className="rounded-xl border border-primary/20 bg-card p-6 shadow-[0_20px_60px_rgba(0,0,0,0.25)] sm:p-8">
          <div className="mb-6 flex items-start gap-3">
            <div className="rounded-lg bg-primary/15 p-2 text-primary">
              <ShieldCheck className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Developer Portal</h1>
              <p className="mt-1 text-sm text-muted">
                Sign in with an authorized developer account to manage system accounts.
              </p>
            </div>
          </div>
          <LoginForm redirectTo="/accounts" />
          <Link
            href="/login"
            className="mt-6 flex items-center justify-center gap-2 text-sm text-muted transition-colors hover:text-pink-light"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to regular sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
