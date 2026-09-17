import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Copy,
  ShieldCheck,
} from "lucide-react";
import { Toaster, toast } from "sonner";
import { ethers } from "ethers";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/use-session";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

type SetupWallet = {
  mnemonic: string;
  address: string;
};

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useSession();

  const [mode, setMode] = useState<"login" | "signup">("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [busy, setBusy] = useState(false);

  const [setupWallet, setSetupWallet] =
    useState<SetupWallet | null>(null);

  const [showSeed, setShowSeed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [backupConfirmed, setBackupConfirmed] =
    useState(false);

  /*
   * If the user is already authenticated, check whether
   * this browser has completed first-time wallet setup.
   */
  useEffect(() => {
    if (loading || !user) return;

    const walletSetupComplete =
      localStorage.getItem(
        `wallet_setup_complete:${user.id}`,
      );

    if (walletSetupComplete === "true") {
      navigate({
        to: "/",
        replace: true,
      });
    }
  }, [loading, user, navigate]);

  const generateWallet = () => {
    try {
      /*
       * ethers Wallet.createRandom() uses secure randomness
       * provided by the runtime to generate a real wallet.
       */
      const wallet = ethers.Wallet.createRandom();

      if (!wallet.mnemonic?.phrase) {
        throw new Error(
          "Unable to generate a secure wallet.",
        );
      }

      setSetupWallet({
        mnemonic: wallet.mnemonic.phrase,
        address: wallet.address,
      });

      setShowSeed(false);
      setCopied(false);
      setBackupConfirmed(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to generate wallet.",
      );
    }
  };

  const copySeedPhrase = async () => {
    if (!setupWallet) return;

    try {
      await navigator.clipboard.writeText(
        setupWallet.mnemonic,
      );

      setCopied(true);

      toast.success("Seed phrase copied.");

      setTimeout(() => {
        setCopied(false);
      }, 3000);
    } catch {
      toast.error(
        "Unable to copy the seed phrase. Please write it down manually.",
      );
    }
  };

  const finishWalletSetup = () => {
    if (!user || !setupWallet) return;

    if (!backupConfirmed) {
      toast.error(
        "Confirm that you have securely backed up your seed phrase.",
      );
      return;
    }

    /*
     * Only store that setup was completed.
     *
     * DO NOT store the seed phrase here.
     */
    localStorage.setItem(
      `wallet_setup_complete:${user.id}`,
      "true",
    );

    /*
     * Remove the seed phrase from React state before
     * navigating away.
     */
    setSetupWallet(null);
    setShowSeed(false);
    setBackupConfirmed(false);

    toast.success("Wallet setup completed.");

    navigate({
      to: "/",
      replace: true,
    });
  };

  const login = async () => {
    const cleanEmail = email.trim();

    if (!cleanEmail || !password) {
      toast.error("Enter your email and password.");
      return;
    }

    setBusy(true);

    try {
      const { error } =
        await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

      if (error) {
        throw error;
      }

      toast.success("Login successful.");

      /*
       * The auth state listener will update user.
       * The effect above will determine whether this is
       * first-time setup or a returning user.
       */
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to log in.",
      );
    } finally {
      setBusy(false);
    }
  };

  const signup = async () => {
    const cleanEmail = email.trim();

    if (!cleanEmail || !password || !confirmPassword) {
      toast.error("Complete all fields.");
      return;
    }

    if (password.length < 6) {
      toast.error(
        "Password must be at least 6 characters.",
      );
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setBusy(true);

    try {
      const { data, error } =
        await supabase.auth.signUp({
          email: cleanEmail,
          password,
        });

      if (error) {
        throw error;
      }

      /*
       * If email confirmation is disabled, Supabase
       * returns a session immediately.
       */
      if (data.session && data.user) {
        toast.success("Account created successfully.");

        /*
         * Generate the first wallet locally.
         */
        const wallet = ethers.Wallet.createRandom();

        if (!wallet.mnemonic?.phrase) {
          throw new Error(
            "Unable to generate your wallet.",
          );
        }

        setSetupWallet({
          mnemonic: wallet.mnemonic.phrase,
          address: wallet.address,
        });

        setShowSeed(false);
        setCopied(false);
        setBackupConfirmed(false);

        return;
      }

      /*
       * If there is no session, the Supabase project is
       * requiring email confirmation.
       */
      toast.info(
        "Account created. Email confirmation is currently required.",
      );

      setMode("login");
      setPassword("");
      setConfirmPassword("");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to create account.",
      );
    } finally {
      setBusy(false);
    }
  };

  const forgotPassword = async () => {
    const cleanEmail = email.trim();

    if (!cleanEmail) {
      toast.error("Enter your email address first.");
      return;
    }

    setBusy(true);

    try {
      const { error } =
        await supabase.auth.resetPasswordForEmail(
          cleanEmail,
          {
            redirectTo:
              `${window.location.origin}/auth`,
          },
        );

      if (error) {
        throw error;
      }

      toast.success(
        "Password reset instructions have been sent to your email.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to send password reset email.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0e1015] text-white">
        <Loader2 className="h-7 w-7 animate-spin" />
      </div>
    );
  }

  /*
   * FIRST-TIME WALLET SETUP SCREEN
   */
  if (setupWallet) {
    return (
      <div className="min-h-screen bg-[#0e1015] text-white flex items-center justify-center px-4 py-8">
        <Toaster position="top-center" />

        <div className="w-full max-w-lg">
          <div className="rounded-3xl border border-white/10 bg-[#151820] p-6 shadow-2xl">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10">
                <ShieldCheck className="h-8 w-8" />
              </div>

              <h1 className="text-2xl font-bold">
                Secure Your Wallet
              </h1>

              <p className="mt-3 text-sm leading-6 text-white/60">
                Your wallet has been created. Back up
                your seed phrase before continuing.
              </p>
            </div>

            <div className="mt-6 rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-4">
              <p className="text-sm font-semibold text-yellow-300">
                Important
              </p>

              <p className="mt-2 text-sm leading-6 text-white/60">
                Your seed phrase is the master key to
                your wallet. Anyone who has it can
                control the wallet. Never share it with
                anyone.
              </p>
            </div>

            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-white/70">
                  Your recovery phrase
                </span>

                <button
                  type="button"
                  onClick={() =>
                    setShowSeed(!showSeed)
                  }
                  className="flex items-center gap-2 text-sm text-white/50 hover:text-white"
                >
                  {showSeed ? (
                    <>
                      <EyeOff className="h-4 w-4" />
                      Hide
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4" />
                      Show
                    </>
                  )}
                </button>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                {showSeed ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {setupWallet.mnemonic
                      .split(" ")
                      .map((word, index) => (
                        <div
                          key={`${word}-${index}`}
                          className="rounded-xl bg-white/5 px-3 py-3"
                        >
                          <span className="mr-2 text-xs text-white/30">
                            {index + 1}
                          </span>

                          <span className="text-sm font-medium">
                            {word}
                          </span>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <Lock className="mx-auto h-7 w-7 text-white/30" />

                    <p className="mt-3 text-sm text-white/40">
                      Your recovery phrase is hidden.
                    </p>

                    <button
                      type="button"
                      onClick={() =>
                        setShowSeed(true)
                      }
                      className="mt-4 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-black"
                    >
                      Reveal Phrase
                    </button>
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={copySeedPhrase}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-medium hover:bg-white/10"
            >
              <Copy className="h-4 w-4" />

              {copied
                ? "Copied"
                : "Copy Seed Phrase"}
            </button>

            <div className="mt-5 rounded-xl bg-white/5 p-4">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={backupConfirmed}
                  onChange={(e) =>
                    setBackupConfirmed(
                      e.target.checked,
                    )
                  }
                  className="mt-1 h-4 w-4"
                />

                <span className="text-sm leading-5 text-white/70">
                  I have securely backed up my seed
                  phrase and understand that it cannot
                  be recovered if I lose it.
                </span>
              </label>
            </div>

            <button
              type="button"
              disabled={!backupConfirmed}
              onClick={finishWalletSetup}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3.5 font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <CheckCircle2 className="h-5 w-5" />
              Continue to Wallet
            </button>

            <p className="mt-4 text-center text-xs leading-5 text-white/30">
              Never send your seed phrase to support,
              administrators, or anyone claiming they
              can recover your wallet.
            </p>
          </div>
        </div>
      </div>
    );
  }

  /*
   * LOGIN / SIGNUP SCREEN
   */
  return (
    <div className="min-h-screen bg-[#0e1015] text-white flex items-center justify-center px-4">
      <Toaster position="top-center" />

      <div className="w-full max-w-md">
        <button
          type="button"
          onClick={() => navigate({ to: "/" })}
          className="mb-6 flex items-center gap-2 text-sm text-white/60 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <div className="rounded-3xl border border-white/10 bg-[#151820] p-6 shadow-2xl">
          <div className="mb-7 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
              <Lock className="h-7 w-7" />
            </div>

            <h1 className="text-2xl font-bold">
              {mode === "login"
                ? "Welcome back"
                : "Create your account"}
            </h1>

            <p className="mt-2 text-sm text-white/50">
              {mode === "login"
                ? "Log in to access your wallet."
                : "Create an account to access your wallet."}
            </p>
          </div>

          <div className="mb-6 grid grid-cols-2 rounded-xl bg-white/5 p-1">
            <button
              type="button"
              onClick={() => setMode("login")}
              disabled={busy}
              className={`rounded-lg py-2.5 text-sm font-medium transition ${
                mode === "login"
                  ? "bg-white text-black"
                  : "text-white/60 hover:text-white"
              }`}
            >
              Login
            </button>

            <button
              type="button"
              onClick={() => setMode("signup")}
              disabled={busy}
              className={`rounded-lg py-2.5 text-sm font-medium transition ${
                mode === "signup"
                  ? "bg-white text-black"
                  : "text-white/60 hover:text-white"
              }`}
            >
              Sign Up
            </button>
          </div>

          <div className="space-y-4">
            {/* Email */}
            <div>
              <label className="mb-2 block text-sm text-white/70">
                Email
              </label>

              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />

                <input
                  type="email"
                  value={email}
                  onChange={(e) =>
                    setEmail(e.target.value)
                  }
                  placeholder="you@example.com"
                  autoComplete="email"
                  disabled={busy}
                  className="w-full rounded-xl border border-white/10 bg-black/20 py-3 pl-10 pr-3 outline-none transition focus:border-white/30 disabled:opacity-50"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="mb-2 block text-sm text-white/70">
                Password
              </label>

              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />

                <input
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  value={password}
                  onChange={(e) =>
                    setPassword(e.target.value)
                  }
                  placeholder="Enter password"
                  autoComplete={
                    mode === "login"
                      ? "current-password"
                      : "new-password"
                  }
                  disabled={busy}
                  className="w-full rounded-xl border border-white/10 bg-black/20 py-3 pl-10 pr-11 outline-none transition focus:border-white/30 disabled:opacity-50"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword(
                      !showPassword,
                    )
                  }
                  disabled={busy}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white disabled:opacity-50"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Confirm password */}
            {mode === "signup" && (
              <div>
                <label className="mb-2 block text-sm text-white/70">
                  Confirm password
                </label>

                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />

                  <input
                    type={
                      showConfirm
                        ? "text"
                        : "password"
                    }
                    value={confirmPassword}
                    onChange={(e) =>
                      setConfirmPassword(
                        e.target.value,
                      )
                    }
                    placeholder="Confirm password"
                    autoComplete="new-password"
                    disabled={busy}
                    className="w-full rounded-xl border border-white/10 bg-black/20 py-3 pl-10 pr-11 outline-none transition focus:border-white/30 disabled:opacity-50"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowConfirm(
                        !showConfirm,
                      )
                    }
                    disabled={busy}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white disabled:opacity-50"
                  >
                    {showConfirm ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Forgot password */}
            {mode === "login" && (
              <button
                type="button"
                onClick={forgotPassword}
                disabled={busy}
                className="text-left text-sm text-white/50 hover:text-white disabled:opacity-50"
              >
                Forgot password?
              </button>
            )}

            {/* Main action */}
            <button
              type="button"
              disabled={busy}
              onClick={
                mode === "login"
                  ? login
                  : signup
              }
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3.5 font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-5 w-5" />
              )}

              {mode === "login"
                ? "Login"
                : "Create Account"}
            </button>
          </div>

          <div className="mt-6 text-center text-xs text-white/40">
            Anyone can create an account.
          </div>
        </div>
      </div>
    </div>
  );
}