"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get("next") || "/dashboard";

  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoModal, setInfoModal] = useState<"signup" | "forgot" | null>(null);

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) {
        setError(
          authError.message === "Invalid login credentials"
            ? "Incorrect email or password. Please try again."
            : authError.message
        );
        setSubmitting(false);
        return;
      }

      router.replace(nextUrl);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
      setSubmitting(false);
    }
  };

  return (
    <main className="login-page relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0c0c12] p-4 sm:p-6 lg:p-8">
      {/* Full Background Image */}
      <div
        className="background-image absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/images/background.jpg')",
        }}
      />

      {/* Subtle Tint Overlay */}
      <div className="background-overlay absolute inset-0 bg-black/20 backdrop-blur-[0.5px]" />

      {/* Pink decorative glow */}
      <div className="pink-glow pink-glow-one pointer-events-none absolute -left-32 -top-32 h-[450px] w-[450px] rounded-full bg-primary/15 blur-[120px]" />
      <div className="pink-glow pink-glow-two pointer-events-none absolute -bottom-32 -right-32 h-[450px] w-[450px] rounded-full bg-primary/10 blur-[130px]" />

      <div className="login-container relative z-10 grid w-full max-w-5xl grid-cols-1 overflow-hidden rounded-3xl border border-white/20 bg-black/30 shadow-[0_25px_70px_rgba(0,0,0,0.5)] backdrop-blur-md lg:grid-cols-12">
        {/* =========================
            LEFT SIDE - BRANDING
        ========================== */}
        <section className="brand-section relative flex flex-col items-center justify-center border-b border-white/10 bg-black/15 p-8 text-center sm:p-12 lg:col-span-5 lg:border-b-0 lg:border-r">
          {/* Subtle accent glow */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/[0.06] via-transparent to-primary/[0.03]" />

          <div className="brand-content relative z-10 flex flex-col items-center">
            <div className="relative mb-6 flex items-center justify-center">
              <div className="absolute -inset-4 rounded-full bg-primary/20 opacity-60 blur-xl" />
              <Image
                src="/images/a_clean_graphic_logo_on_a_transparent_background.png"
                alt="Daily Pearls Ph"
                width={160}
                height={160}
                priority
                className="brand-logo relative h-32 w-32 object-contain drop-shadow-[0_10px_25px_rgba(255,61,141,0.35)]"
              />
            </div>

            <div className="brand-divider mb-5 flex items-center gap-3 text-white">
              <span className="h-[1px] w-12 bg-gradient-to-r from-transparent to-white/70" />
              <div className="diamond text-xs text-white">◆</div>
              <span className="h-[1px] w-12 bg-gradient-to-l from-transparent to-white/70" />
            </div>

            <h2 className="brand-tagline text-lg font-bold tracking-[0.2em] text-white sm:text-xl">
              TIMELESS ELEGANCE,
              <br />
              EVERYDAY.
            </h2>

            <p className="brand-description mt-3 max-w-xs text-xs font-normal leading-relaxed text-white/90 sm:text-sm">
              Jewelry that celebrates every moment,
              <br />
              every memory, and every story.
            </p>

            <div className="mt-8 rounded-full border border-white/30 bg-white/10 px-3.5 py-1 text-[11px] font-semibold tracking-wider text-white backdrop-blur-sm">
              DAILY PEARLS PH &bull; OMS
            </div>
          </div>
        </section>

        {/* =========================
            RIGHT SIDE - LOGIN
        ========================== */}
        <section className="login-section flex flex-col justify-center bg-black/20 p-6 sm:p-10 lg:col-span-7 lg:p-12">
          <div className="login-card mx-auto w-full max-w-md">

            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Log In to Your Account
            </h1>

            <p className="login-subtitle mt-1.5 text-xs text-white/90 sm:text-sm">
              Welcome back! Please enter your details to continue.
            </p>

            {error ? (
              <div
                role="alert"
                className="mt-4 rounded-xl border border-danger/40 bg-danger/20 p-3 text-xs font-semibold text-white backdrop-blur-sm animate-in fade-in"
              >
                {error}
              </div>
            ) : null}

            <form onSubmit={handleLogin} className="mt-6 space-y-4">
              {/* EMAIL */}
              <div className="form-group space-y-1.5">
                <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-white">
                  Email Address
                </label>

                <div className="input-wrapper relative flex items-center">
                  <svg
                    className="input-icon pointer-events-none absolute left-3.5 h-4 w-4 text-white/80"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <rect
                      x="3"
                      y="5"
                      width="18"
                      height="14"
                      rx="2"
                      stroke="currentColor"
                      strokeWidth="1.7"
                    />
                    <path
                      d="M3 7L12 13L21 7"
                      stroke="currentColor"
                      strokeWidth="1.7"
                    />
                  </svg>

                  <input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={submitting}
                    className="h-11 w-full rounded-xl border border-white/20 bg-black/40 pl-10 pr-4 text-sm text-white placeholder:text-white/45 backdrop-blur-sm transition-all focus:border-primary focus:bg-black/60 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              {/* PASSWORD */}
              <div className="form-group space-y-1.5">
                <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-white">
                  Password
                </label>

                <div className="input-wrapper relative flex items-center">
                  <svg
                    className="input-icon pointer-events-none absolute left-3.5 h-4 w-4 text-white/80"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <rect
                      x="5"
                      y="10"
                      width="14"
                      height="10"
                      rx="2"
                      stroke="currentColor"
                      strokeWidth="1.7"
                    />
                    <path
                      d="M8 10V7C8 4.8 9.8 3 12 3C14.2 3 16 4.8 16 7V10"
                      stroke="currentColor"
                      strokeWidth="1.7"
                    />
                  </svg>

                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={submitting}
                    className="h-11 w-full rounded-xl border border-white/20 bg-black/40 pl-10 pr-11 text-sm text-white placeholder:text-white/45 backdrop-blur-sm transition-all focus:border-primary focus:bg-black/60 focus:outline-none focus:ring-1 focus:ring-primary"
                  />

                  <button
                    type="button"
                    className="password-toggle absolute right-3 rounded-lg p-1 text-white/80 transition-colors hover:text-white"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M2 2L22 22"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                        />
                        <path
                          d="M10.6 10.6C10.2 11 10 11.5 10 12C10 13.1 10.9 14 12 14C12.5 14 13 13.8 13.4 13.4"
                          stroke="currentColor"
                          strokeWidth="1.7"
                        />
                        <path
                          d="M9.9 5.2C10.6 5 11.3 4.9 12 4.9C17.5 4.9 21 12 21 12C21 12 20.1 13.9 18.4 15.7"
                          stroke="currentColor"
                          strokeWidth="1.7"
                        />
                        <path
                          d="M6.2 6.3C3.5 8.3 2 12 2 12C2 12 5.5 19.1 12 19.1C13.2 19.1 14.3 18.9 15.3 18.5"
                          stroke="currentColor"
                          strokeWidth="1.7"
                        />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M2 12C2 12 5.5 5 12 5C18.5 5 22 12 22 12C22 12 18.5 19 12 19C5.5 19 2 12 2 12Z"
                          stroke="currentColor"
                          strokeWidth="1.7"
                        />
                        <circle
                          cx="12"
                          cy="12"
                          r="3"
                          stroke="currentColor"
                          strokeWidth="1.7"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* OPTIONS */}
              <div className="login-options flex items-center justify-between pt-1 text-xs">
                <label className="remember flex cursor-pointer items-center gap-2 text-white/90 transition-colors hover:text-white">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="sr-only"
                  />
                  <span
                    className={`custom-checkbox flex h-4 w-4 items-center justify-center rounded border transition-all ${
                      rememberMe
                        ? "border-primary bg-primary text-[10px] font-bold text-white shadow-sm shadow-primary/30"
                        : "border-white/30 bg-black/40"
                    }`}
                  >
                    {rememberMe && "✓"}
                  </span>
                  <span className="text-white font-medium">Remember me</span>
                </label>

                <button
                  type="button"
                  onClick={() => setInfoModal("forgot")}
                  className="forgot-password text-xs font-semibold text-white transition-colors hover:text-pink-light hover:underline"
                >
                  Forgot password?
                </button>
              </div>

              {/* LOGIN BUTTON */}
              <button
                type="submit"
                disabled={submitting}
                className="login-button relative flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-hover font-semibold text-white shadow-lg shadow-primary/25 transition-all hover:scale-[1.01] hover:shadow-primary/40 active:scale-[0.99] disabled:opacity-50"
              >
                <span>{submitting ? "Signing In..." : "Log In"}</span>

                {!submitting && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M5 12H19"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <path
                      d="M13 6L19 12L13 18"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>

              {/* DIVIDER */}
              <div className="divider my-4 flex items-center gap-3">
                <span className="h-[1px] flex-1 bg-white/20" />
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/80">
                  Or continue with
                </p>
                <span className="h-[1px] flex-1 bg-white/20" />
              </div>

              {/* DEVELOPER PORTAL */}
              <Link
                href="/developer/login"
                className="developer-button flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/20 bg-black/35 backdrop-blur-sm text-xs font-semibold text-white transition-all hover:bg-black/50 hover:border-white/40 hover:text-pink-light"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-pink-light"
                >
                  <polyline points="16 18 22 12 16 6" />
                  <polyline points="8 6 2 12 8 18" />
                </svg>
                <span>Developer Portal</span>
              </Link>
            </form>

            <p className="security-text mt-6 text-center text-[11px] text-white/80 font-normal">
              Your information is protected with secure authentication.
            </p>
          </div>
        </section>
      </div>

      {/* Quick Info Modal for Forgot Password or Sign Up Request */}
      {infoModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in"
          onClick={() => setInfoModal(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-white/20 bg-card p-6 shadow-2xl text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-white">
              Password Reset
            </h3>
            <p className="mt-2 text-xs text-white/90 leading-relaxed">
              To reset your account password, please contact the system administrator or an authorized developer in the Developer Portal.
            </p>
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={() => setInfoModal(null)}
                className="rounded-xl bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/20"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
