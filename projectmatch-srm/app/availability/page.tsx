"use client";

import Link from "next/link";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { getFirebaseServices } from "@/lib/firebase/client";
import { people } from "@/lib/demo-data";

const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const slots = ["Morning", "Afternoon", "Evening", "Night"];

const isoDate = (month: number, day: number) => `2026-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

export default function AvailabilityPage() {
  const [month, setMonth] = useState(0);
  const [activeDate, setActiveDate] = useState("2026-01-01");
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  useEffect(() => { const value = localStorage.getItem("projectmatch-availability-2026"); if (value) setSelected(JSON.parse(value) as string[]); }, []);
  const calendar = useMemo(() => {
    const count = new Date(Date.UTC(2026, month + 1, 0)).getUTCDate();
    const offset = (new Date(Date.UTC(2026, month, 1)).getUTCDay() + 6) % 7;
    return [...Array<null>(offset).fill(null), ...Array.from({ length: count }, (_, index) => index + 1)];
  }, [month]);
  const toggle = (slot: string) => { const key = `${activeDate}-${slot}`; setSelected((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]); };
  const save = async () => {
    localStorage.setItem("projectmatch-availability-2026", JSON.stringify(selected));
    const { auth, db } = getFirebaseServices();
    if (auth.currentUser) await setDoc(doc(db, "availability", auth.currentUser.uid), { year: 2026, datedBlocks: selected, updatedAt: serverTimestamp() }, { merge: true }).catch(() => undefined);
    setMessage(`${selected.length} available time blocks saved for 2026.`);
  };
  const flexibleStudents = people.filter((person) => person.availableDays.includes((new Date(`${activeDate}T12:00:00Z`).getUTCDay() + 6) % 7));

  return <main className="min-h-screen bg-[#f5f4ef] px-4 py-10 text-slate-950 sm:px-10"><div className="mx-auto max-w-6xl"><Link href="/dashboard" className="text-sm font-semibold text-emerald-700">← Dashboard</Link><div className="mt-6 flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-widest text-emerald-700">2026 planning</p><h1 className="mt-2 text-4xl font-semibold">Availability calendar</h1><p className="mt-3 text-slate-600">Select a date, then mark the times when you can collaborate.</p></div><label className="font-medium">Month<select value={month} onChange={(event) => { const value = Number(event.target.value); setMonth(value); setActiveDate(isoDate(value, 1)); }} className="ml-3 rounded-xl border border-slate-300 bg-white p-3">{months.map((name, index) => <option value={index} key={name}>{name} 2026</option>)}</select></label></div><section className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]"><div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200"><div className="grid grid-cols-7 gap-2">{weekdays.map((day) => <div className="py-2 text-center text-xs font-semibold uppercase text-slate-500" key={day}>{day}</div>)}{calendar.map((day, index) => day === null ? <div key={`blank-${index}`} /> : (() => { const date = isoDate(month, day); const count = selected.filter((item) => item.startsWith(date)).length; const active = date === activeDate; return <button onClick={() => setActiveDate(date)} aria-pressed={active} className={`min-h-20 rounded-xl border p-2 text-left transition ${active ? "border-emerald-700 bg-emerald-50 ring-2 ring-emerald-200" : "border-slate-200 hover:border-emerald-400"}`} key={date}><span className="font-semibold">{day}</span>{count > 0 && <span className="mt-3 block text-xs text-emerald-700">{count} free {count === 1 ? "block" : "blocks"}</span>}</button>; })())}</div></div><aside className="rounded-2xl bg-slate-950 p-5 text-white"><p className="text-sm text-emerald-300">Selected date</p><h2 className="mt-1 text-xl font-semibold">{new Date(`${activeDate}T12:00:00Z`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}</h2><div className="mt-5 space-y-2">{slots.map((slot) => { const active = selected.includes(`${activeDate}-${slot}`); return <button onClick={() => toggle(slot)} aria-pressed={active} className={`w-full rounded-xl border px-4 py-3 text-left ${active ? "border-emerald-400 bg-emerald-500 text-slate-950" : "border-white/20 bg-white/5"}`} key={slot}>{slot}<span className="float-right">{active ? "Free ✓" : "Mark free"}</span></button>; })}</div><div className="mt-6 border-t border-white/10 pt-5"><p className="text-sm font-semibold">Team flexibility</p><p className="mt-1 text-sm text-slate-300">{flexibleStudents.length} demo students are usually free on this weekday.</p></div></aside></section><div className="mt-5 flex flex-wrap items-center gap-4"><button onClick={save} className="rounded-full bg-emerald-700 px-5 py-3 font-semibold text-white">Save 2026 availability</button><p role="status" className="text-sm text-emerald-800">{message}</p></div></div></main>;
}
