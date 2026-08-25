"use client";

import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { campusShortName, engineeringStreams, people } from "@/lib/demo-data";
import { getFirebaseServices } from "@/lib/firebase/client";
import { availableWeekdays, readAvailability, type DirectoryStudent } from "@/lib/student-data";

const days = ["M", "T", "W", "T", "F", "S", "S"];
type StoredProfile = { uid: string; name?: string; course?: string; academicYear?: string; interests?: string[] };

export default function PeoplePage() {
  const [branch, setBranch] = useState("All");
  const [year, setYear] = useState("All");
  const [skill, setSkill] = useState("");
  const [profiles, setProfiles] = useState<StoredProfile[]>([]);
  const [availability, setAvailability] = useState<Record<string, string[]>>({});
  const [currentId, setCurrentId] = useState("");

  useEffect(() => {
    const { auth, db } = getFirebaseServices();
    const stopAuth = onAuthStateChanged(auth, (user) => {
      if (!user) return;
      setCurrentId(user.uid);
      const saved = localStorage.getItem(`projectmatch-profile-${user.uid}`);
      if (saved) {
        const profile = JSON.parse(saved) as { course: string; year: string; interests: string[] };
        setProfiles((items) => [{ uid: user.uid, name: user.displayName ?? "SRM student", course: profile.course, academicYear: profile.year, interests: profile.interests }, ...items.filter((item) => item.uid !== user.uid)]);
      }
      setAvailability((items) => ({ ...items, [user.uid]: readAvailability() }));
    });
    const stopProfiles = onSnapshot(collection(db, "users"), (snapshot) => {
      const remote = snapshot.docs.map((item) => ({ uid: item.id, ...item.data() }) as StoredProfile);
      setProfiles((items) => {
        const merged = new Map([...items, ...remote].map((profile) => [profile.uid, profile]));
        return [...merged.values()];
      });
    }, () => undefined);
    const stopAvailability = onSnapshot(collection(db, "availability"), (snapshot) => {
      setAvailability((items) => ({ ...items, ...Object.fromEntries(snapshot.docs.map((item) => [item.id, (item.data().datedBlocks as string[] | undefined) ?? []])) }));
    }, () => undefined);
    return () => { stopAuth(); stopProfiles(); stopAvailability(); };
  }, []);

  const realStudents = useMemo<DirectoryStudent[]>(() => profiles.filter((profile) => profile.course && profile.academicYear).map((profile) => ({
    id: profile.uid,
    handle: profile.uid,
    name: profile.name ?? "SRM student",
    branch: profile.course ?? "OTHER",
    year: profile.academicYear ?? "Student",
    skills: profile.interests ?? [],
    bio: "SRM Kattankulathur student looking for collaborative campus projects.",
    availableDays: availableWeekdays(availability[profile.uid] ?? []),
    freshness: `${availability[profile.uid]?.length ?? 0} dated blocks saved for 2026`,
    isCurrent: profile.uid === currentId,
  })), [availability, currentId, profiles]);
  const directory = useMemo(() => [...realStudents, ...people], [realStudents]);
  const results = useMemo(() => directory.filter((person) =>
    (branch === "All" || person.branch === branch) &&
    (year === "All" || person.year === year) &&
    (!skill || person.skills.join(" ").toLowerCase().includes(skill.toLowerCase())),
  ), [branch, directory, skill, year]);
  const clear = () => { setBranch("All"); setYear("All"); setSkill(""); };

  return <main className="min-h-screen bg-[#f4f7fb] px-5 py-10 text-slate-950 sm:px-10"><div className="mx-auto max-w-7xl"><nav className="flex items-center justify-between"><Link href="/dashboard" className="text-sm font-semibold text-blue-700">← Student dashboard</Link><Link href="/availability" className="rounded-full bg-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-sm">Set your availability</Link></nav><header className="mt-8 max-w-3xl"><p className="text-sm font-semibold uppercase tracking-[.18em] text-blue-700">SRM Kattankulathur student directory</p><h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Find your next campus teammate</h1><p className="mt-4 text-lg text-slate-600">Profiles now include each student&apos;s saved 2026 availability.</p></header><section className="mt-8 grid gap-3 rounded-3xl border border-blue-100 bg-white p-5 shadow-sm md:grid-cols-3"><label className="text-sm font-medium">Engineering stream<select value={branch} onChange={(event) => setBranch(event.target.value)} className="mt-1 block w-full rounded-xl border p-3"><option value="All">All engineering streams</option>{engineeringStreams.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label className="text-sm font-medium">Academic year<select value={year} onChange={(event) => setYear(event.target.value)} className="mt-1 block w-full rounded-xl border p-3"><option>All</option>{["1st Year", "2nd Year", "3rd Year", "4th Year"].map((value) => <option key={value}>{value}</option>)}</select></label><label className="text-sm font-medium">Skill or interest<input value={skill} onChange={(event) => setSkill(event.target.value)} placeholder="e.g. Robotics" className="mt-1 block w-full rounded-xl border p-3" /></label></section><p className="mt-6 text-sm font-medium text-slate-600">{results.length} SRM students available</p><section className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{results.map((person) => <article className={`rounded-3xl bg-white p-5 shadow-sm ring-1 transition hover:-translate-y-1 hover:shadow-xl ${person.isCurrent ? "ring-2 ring-blue-500" : "ring-slate-200 hover:ring-blue-200"}`} key={person.handle}><div className="mb-4 flex items-center justify-between gap-2"><p className="text-xs font-semibold uppercase tracking-[.13em] text-blue-700">Student · {campusShortName}</p>{person.isCurrent ? <span className="rounded-full bg-blue-700 px-2 py-1 text-xs font-semibold text-white">Your profile</span> : null}</div><div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-400 font-semibold text-white">{person.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</div><div><h2 className="font-semibold">{person.name}</h2><p className="text-sm text-slate-500">{person.branch} · {person.year}</p></div></div><p className="mt-4 text-sm leading-6 text-slate-600">{person.bio}</p><div className="mt-4 flex flex-wrap gap-2">{person.skills.map((item) => <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs text-blue-800" key={item}>{item}</span>)}</div><p className="mt-5 text-xs font-semibold uppercase text-slate-500">Free days · {person.freshness}</p><div className="mt-2 flex gap-1">{days.map((day, index) => <span key={`${day}${index}`} aria-label={`${day}: ${person.availableDays.includes(index) ? "available" : "unavailable"}`} className={`grid h-7 w-7 place-items-center rounded text-xs ${person.availableDays.includes(index) ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400"}`}>{day}</span>)}</div>{person.isCurrent ? <Link href="/availability" className="mt-5 inline-block text-sm font-semibold text-blue-700">Update free time →</Link> : null}</article>)}</section>{results.length === 0 ? <section className="mt-8 rounded-3xl border border-dashed bg-white p-10 text-center"><h2 className="text-lg font-semibold">No students match these filters</h2><button onClick={clear} className="mt-4 rounded-full bg-blue-700 px-4 py-2 font-semibold text-white">Clear filters</button></section> : null}</div></main>;
}
