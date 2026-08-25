"use client";

import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { engineeringStreams, studentInterests } from "@/lib/demo-data";
import { getFirebaseServices } from "@/lib/firebase/client";

export default function OnboardingPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [course, setCourse] = useState("");
  const [year, setYear] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => onAuthStateChanged(getFirebaseServices().auth, (currentUser) => {
    if (!currentUser) { router.replace("/signin"); return; }
    setUser(currentUser);
    const saved = localStorage.getItem(`projectmatch-profile-${currentUser.uid}`);
    if (saved) {
      const value = JSON.parse(saved) as { course: string; year: string; interests: string[] };
      setCourse(value.course); setYear(value.year); setInterests(value.interests);
    }
  }), [router]);

  const toggleInterest = (interest: string) => setInterests((current) => current.includes(interest) ? current.filter((item) => item !== interest) : [...current, interest]);
  const save = async () => {
    if (!user || !course || !year || interests.length === 0) { setError("Choose your course, academic year, and at least one interest."); return; }
    setBusy(true); setError("");
    const profile = { course, academicYear: year, interests, onboardingCompleted: true };
    localStorage.setItem(`projectmatch-profile-${user.uid}`, JSON.stringify({ course, year, interests }));
    await setDoc(doc(getFirebaseServices().db, "users", user.uid), { uid: user.uid, email: user.email, name: user.displayName, image: user.photoURL, ...profile, updatedAt: serverTimestamp() }, { merge: true }).catch(() => undefined);
    router.replace("/dashboard");
  };

  return <main className="min-h-screen bg-[#f5f4ef] px-5 py-10 text-slate-950"><section className="mx-auto max-w-3xl rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-10"><p className="text-sm font-semibold uppercase tracking-widest text-emerald-700">Set up your student profile</p><h1 className="mt-3 text-4xl font-semibold tracking-tight">What are you building toward?</h1><p className="mt-3 text-slate-600">These choices personalize teammate and project recommendations. You can update them whenever you sign in.</p><div className="mt-8 grid gap-5 sm:grid-cols-2"><label className="font-medium">Engineering course<select value={course} onChange={(event) => setCourse(event.target.value)} className="mt-2 block w-full rounded-xl border border-slate-300 p-3"><option value="">Choose your course</option>{engineeringStreams.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label className="font-medium">Academic year<select value={year} onChange={(event) => setYear(event.target.value)} className="mt-2 block w-full rounded-xl border border-slate-300 p-3"><option value="">Choose your year</option>{["1st Year", "2nd Year", "3rd Year", "4th Year"].map((item) => <option key={item}>{item}</option>)}</select></label></div><fieldset className="mt-8"><legend className="font-medium">Your interests <span className="font-normal text-slate-500">(choose one or more)</span></legend><div className="mt-3 flex flex-wrap gap-2">{studentInterests.map((interest) => { const active = interests.includes(interest); return <button type="button" aria-pressed={active} onClick={() => toggleInterest(interest)} className={`rounded-full border px-4 py-2 text-sm ${active ? "border-emerald-700 bg-emerald-700 text-white" : "border-slate-300 bg-white"}`} key={interest}>{interest}</button>; })}</div></fieldset>{error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}<button onClick={save} disabled={busy} className="mt-8 w-full rounded-xl bg-slate-950 px-5 py-3 font-semibold text-white disabled:opacity-60">{busy ? "Saving your profile…" : "Continue to dashboard"}</button></section></main>;
}
