"use client";

import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { collection, onSnapshot } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { engineeringStreams, people } from "@/lib/demo-data";
import { getFirebaseServices } from "@/lib/firebase/client";

type MessageStudent = { id: string; name: string; branch: string; year: string; skills: string[]; isDemo?: boolean };
type StoredProfile = { uid: string; name?: string; course?: string; academicYear?: string; interests?: string[] };

export default function MessagesPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profiles, setProfiles] = useState<StoredProfile[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const { auth, db } = getFirebaseServices();
    const stopAuth = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) router.replace("/signin");
      else setUser(currentUser);
    });
    const stopProfiles = onSnapshot(collection(db, "users"), (snapshot) => {
      setProfiles(snapshot.docs.map((item) => ({ uid: item.id, ...item.data() }) as StoredProfile));
    }, () => undefined);
    return () => { stopAuth(); stopProfiles(); };
  }, [router]);

  const students = useMemo<MessageStudent[]>(() => {
    const real = profiles.filter((profile) => profile.uid !== user?.uid).map((profile) => ({ id: profile.uid, name: profile.name ?? "SRM student", branch: profile.course ?? "OTHER", year: profile.academicYear ?? "Student", skills: profile.interests ?? [] }));
    const demo = people.map((person) => ({ id: person.handle, name: person.name, branch: person.branch, year: person.year, skills: person.skills, isDemo: true }));
    return [...real, ...demo];
  }, [profiles, user?.uid]);
  const results = useMemo(() => students.filter((student) => `${student.name} ${student.branch} ${student.skills.join(" ")}`.toLowerCase().includes(search.toLowerCase())), [search, students]);

  if (!user) return <main className="grid min-h-screen place-items-center bg-slate-950 text-white">Loading student messages…</main>;
  return <main className="min-h-screen bg-[#f4f7fb] px-5 py-10 text-slate-950 sm:px-10"><div className="mx-auto max-w-5xl"><nav className="flex items-center justify-between"><Link href="/dashboard" className="text-sm font-semibold text-blue-700">← Student dashboard</Link><Link href="/people" className="text-sm font-semibold text-blue-700">Browse people</Link></nav><header className="mt-8"><p className="text-sm font-semibold uppercase tracking-[.16em] text-blue-700">Private student chat</p><h1 className="mt-3 text-4xl font-semibold tracking-tight">Message an SRM student</h1><p className="mt-3 max-w-2xl text-slate-600">Choose a student to start or continue a private conversation saved to your device and Firebase.</p></header><label className="mt-7 block max-w-xl font-medium">Find a student<input value={search} onChange={(event) => setSearch(event.target.value)} className="mt-2 block w-full rounded-xl border border-slate-300 bg-white p-3" placeholder="Search by name, stream, skill, or interest" /></label><section className="mt-7 grid gap-4 sm:grid-cols-2">{results.map((student) => <article className="flex items-center justify-between gap-4 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200" key={student.id}><div className="flex min-w-0 items-center gap-3"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-400 font-semibold text-white">{student.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</div><div className="min-w-0"><h2 className="truncate font-semibold">{student.name}</h2><p className="text-sm text-slate-500">{engineeringStreams.find(([value]) => value === student.branch)?.[1] ?? student.branch} · {student.year}</p><p className="mt-1 truncate text-xs text-slate-500">{student.skills.slice(0, 3).join(" · ")}</p></div></div><Link href={`/messages/${student.id}`} className="shrink-0 rounded-full bg-blue-700 px-4 py-2 text-sm font-semibold text-white">Chat</Link></article>)}</section>{results.length === 0 ? <p className="mt-8 rounded-2xl bg-white p-8 text-center text-slate-600">No students match that search.</p> : null}</div></main>;
}
