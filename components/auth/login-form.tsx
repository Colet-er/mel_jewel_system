"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";

interface LoginFormProps {
  redirectTo?: string;
}

export function LoginForm({ redirectTo = "/dashboard" }: LoginFormProps = {}) {
  const router = useRouter();
  const [values, setValues] = useState<LoginInput>({ email: "", password: "" });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof LoginInput, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleChange(field: keyof LoginInput) {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      setValues((v) => ({ ...v, [field]: event.target.value }));
      setFieldErrors((e) => ({ ...e, [field]: undefined }));
      setFormError(null);
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const parsed = loginSchema.safeParse(values);
    if (!parsed.success) {
      const errors: Partial<Record<keyof LoginInput, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string" && !(key in errors)) {
          errors[key as keyof LoginInput] = issue.message;
        }
      }
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });

    if (error) {
      setFormError(
        error.message === "Invalid login credentials"
          ? "Incorrect email or password."
          : `Sign in failed: ${error.message}`
      );
      setSubmitting(false);
      return;
    }

    router.replace(redirectTo);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          value={values.email}
          onChange={handleChange("email")}
          hasError={Boolean(fieldErrors.email)}
          required
        />
        <FieldError message={fieldErrors.email} />
      </div>

      <div>
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={values.password}
          onChange={handleChange("password")}
          hasError={Boolean(fieldErrors.password)}
          required
        />
        <FieldError message={fieldErrors.password} />
      </div>

      {formError ? (
        <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {formError}
        </p>
      ) : null}

      <Button type="submit" size="lg" className="w-full" disabled={submitting}>
        {submitting ? "Signing in…" : "Sign in"}
      </Button>

      <p className="text-center text-xs text-muted">
        Need an account? Contact your administrator.{" "}
        <Link href="/login" className="text-pink-light hover:underline">
          Learn more
        </Link>
      </p>
    </form>
  );
}

export function LoginBrand() {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <Image
        src="/images/a_clean_graphic_logo_on_a_transparent_background.png"
        alt="Daily Pearls Ph"
        width={160}
        height={160}
        priority
        className="h-32 w-32 object-contain drop-shadow-[0_10px_25px_rgba(255,61,141,0.3)] sm:h-36 sm:w-36"
      />
      <p className="text-sm font-medium tracking-wide text-muted">Order Management</p>
    </div>
  );
}
