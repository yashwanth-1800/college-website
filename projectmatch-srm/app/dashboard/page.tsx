"use client";

import Link from "next/link";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { engineeringStreams, projects } from "@/lib/demo-data";
import { getFirebaseServices } from "@/lib/firebase/client";
import { readAvailability, readCreatedProjects } from "@/lib/student-data";

type SavedProfile = { course: string; year: string; interests: string[] };

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<SavedProfile | null>(null);
  const [applications, setApplications] = useState(0);
  const [created, setCreated] = useState(0);
  const [freeBlocks, setFreeBlocks] = useState(0);

  useEffect(() => onAuthStateChanged(getFirebaseServices().auth, (currentUser) => {
    if (!currentUser) { router.replace("/signin"); return; }
    setUser(currentUser);
    const saved = localStorage.getItem(`projectmatch-profile-${currentUser.uid}`);
    if (saved) setProfile(JSON.parse(saved) as SavedProfile);
    setApplications(projects.filter((project) => localStorage.getItem(`projectmatch-application-${project.id}`)).length);
    setCreated(readCreatedProjects().filter((project) => project.ownerId === currentUser.uid).length);
    setFreeBlocks(readAvailability().length);
  }), [router]);

  if (!user) return <main className="grid min-h-screen place-items-center bg-slate-950 text-white">Loading your workspace…</main>;
  const courseName = engineeringStreams.find(([value]) => value === profile?.course)?.[1];

  return <main className="min-h-screen bg-[#f4f7fb] p-6 text-slate-950 sm:p-10"><div className="mx-auto max-w-6xl"><header className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm font-semibold text-blue-700">SRM KATTANKULATHUR · STUDENT WORKSPACE</p><h1 className="mt-1 text-3xl font-semibold">Welcome, {user.displayName?.split(" ")[0] ?? "teammate"}</h1><p className="mt-1 text-slate-600">{user.email}</p></div><button onClick={async () => { await signOut(getFirebaseServices().auth); window.location.replace("/signin"); }} className="rounded-full border border-slate-300 bg-white px-4 py-2">Sign out</button></header>
    {profile ? <section className="mt-8 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-blue-100"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold text-blue-700">Your visible student profile</p><h2 className="mt-1 text-xl font-semibold">{courseName} · {profile.year}</h2><div className="mt-3 flex flex-wrap gap-2">{profile.interests.map((interest) => <span className="rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-800" key={interest}>{interest}</span>)}</div></div><Link href="/onboarding" className="rounded-full border border-slate-300 px-4 py-2 text-sm">Edit profile</Link></div></section> : <Link href="/onboarding" className="mt-8 block rounded-2xl bg-amber-50 p-5 text-amber-900 ring-1 ring-amber-200">Complete your course and interests to appear in Browse People →</Link>}
    <section className="mt-8 grid gap-5 md:grid-cols-2"><Link href="/projects/new" className="rounded-3xl bg-gradient-to-br from-blue-700 to-cyan-600 p-7 text-white shadow-lg"><p className="text-sm text-blue-100">{created} projects created</p><h2 className="mt-2 text-2xl font-semibold">Add your project</h2><p className="mt-2 text-blue-50">Publish an idea, list missing skills, and start a saved project discussion.</p><span className="mt-5 inline-block font-semibold">Create project →</span></Link><Link href="/availability" className="rounded-3xl bg-slate-950 p-7 text-white shadow-lg"><p className="text-sm text-cyan-300">{freeBlocks} saved time blocks</p><h2 className="mt-2 text-2xl font-semibold">Set your free time</h2><p className="mt-2 text-slate-300">Mark dated 2026 availability shown with your Browse People profile.</p><span className="mt-5 inline-block font-semibold text-cyan-300">Open calendar →</span></Link></section>
    <section className="mt-5 grid gap-5 md:grid-cols-3"><Link href="/people" className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200"><h2 className="text-xl font-semibold">Browse people</h2><p className="mt-2 text-slate-600">Find SRM student teammates and compare saved free time.</p></Link><Link href="/projects" className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200"><h2 className="text-xl font-semibold">Explore projects</h2><p className="mt-2 text-slate-600">Open projects, apply, and join saved discussions.</p><p className="mt-4 text-sm font-semibold text-blue-700">{applications} applications submitted</p></Link><Link href="/messages" className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200"><p className="text-sm font-semibold text-blue-700">DIRECT CHAT</p><h2 className="mt-1 text-xl font-semibold">Student messages</h2><p className="mt-2 text-slate-600">Choose an SRM student and continue a private saved conversation.</p></Link></section>
  </div></main>;
}
