import type { Metadata } from "next";
import { LoginForm, LoginBrand } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign in | Order Management",
};

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <LoginBrand />
        </div>
        <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
          <h1 className="mb-1 text-lg font-semibold text-foreground">Sign in</h1>
          <p className="mb-6 text-sm text-muted">
            Enter your credentials to access the dashboard.
          </p>
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
