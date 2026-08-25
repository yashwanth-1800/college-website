"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged, signInWithPopup } from "firebase/auth";
import { getFirebaseServices, googleProvider, isFirebaseConfigured } from "@/lib/firebase/client";

const SIGN_IN_TIMEOUT_MS = 45_000;

function errorMessage(error: unknown): string {
  const code = (error as { code?: string }).code;
  if (code === "auth/unauthorized-domain") return "This address is not authorized in Firebase. Add localhost and your deployed domain under Authentication → Settings → Authorized domains.";
  if (code === "auth/web-storage-unsupported") return "This browser blocked secure sign-in storage. Allow site storage or open ProjectMatch in Chrome, Edge, or Safari.";
  if (code === "auth/network-request-failed") return "Google sign-in could not reach Firebase. Check your connection, confirm localhost is an authorized Firebase domain, and try again.";
  if (code === "auth/popup-blocked") return "The Google sign-in window was blocked. Allow popups for this address, then try again.";
  if (code === "auth/popup-closed-by-user") return "The Google sign-in window was closed before authentication finished. Please try again.";
  if (code === "auth/argument-error") return "Google sign-in could not start correctly. Reload this updated page and try again.";
  return error instanceof Error ? error.message : "Google sign-in could not be completed.";
}

export default function SignInPage() {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const redirecting = useRef(false);

  const finishSignIn = () => {
    if (redirecting.current) return;
    redirecting.current = true;
    setBusy(true);
    setStatus("Signed in. Opening your SRM student profile…");
    // A full transition clears stale App Router state after an OAuth popup.
    window.location.replace("/onboarding");
  };

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    return onAuthStateChanged(getFirebaseServices().auth, (user) => {
      if (user) finishSignIn();
      else if (!redirecting.current) setBusy(false);
    }, (error) => {
      setStatus(errorMessage(error));
      setBusy(false);
    });
  }, []);

  const signIn = async () => {
    if (busy || redirecting.current) return;
    setBusy(true);
    setStatus("Opening Google sign-in…");
    let timeoutId: number | undefined;
    try {
      const timeout = new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(() => reject(new Error("Google sign-in did not finish within 45 seconds. The button has been reset so you can try again.")), SIGN_IN_TIMEOUT_MS);
      });
      const result = await Promise.race([signInWithPopup(getFirebaseServices().auth, googleProvider), timeout]);
      if (!result.user) throw new Error("Google sign-in completed without a user account.");
      finishSignIn();
    } catch (error: unknown) {
      if (!redirecting.current) {
        setStatus(errorMessage(error));
        setBusy(false);
      }
    } finally {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    }
  };

  return <main className="grid min-h-screen place-items-center bg-slate-950 p-6 text-white"><section className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl"><Link href="/" className="text-sm text-cyan-300">← ProjectMatch · SRM</Link><p className="mt-6 text-xs font-semibold uppercase tracking-[.16em] text-cyan-300">SRM Kattankulathur student access</p><h1 className="mt-3 text-3xl font-semibold">Sign in to ProjectMatch</h1><p className="mt-3 text-slate-300">Use Google to create your SRM student profile, save availability, and join campus projects.</p>{isFirebaseConfigured ? <button type="button" onClick={signIn} disabled={busy} className="mt-6 w-full rounded-xl bg-white px-4 py-3 font-semibold text-slate-950 disabled:cursor-wait disabled:opacity-60">{busy ? "Completing sign-in…" : "Continue with Google"}</button> : <p className="mt-6 rounded-xl bg-amber-100 p-3 text-sm text-amber-900">Google sign-in is not configured on this preview.</p>}<p role="status" aria-live="polite" className="mt-4 min-h-5 text-sm text-slate-300">{status}</p><div className="mt-7 border-t border-white/10 pt-5"><p className="font-medium">New here? Explore the SRM student community.</p><Link className="mt-3 inline-block rounded-full border border-white/30 px-4 py-2 text-sm" href="/people">Browse SRM students</Link></div></section></main>;
}
