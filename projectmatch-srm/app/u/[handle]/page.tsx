import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { campusName, people } from "@/lib/demo-data";

export const revalidate = 3600;
export function generateStaticParams() { return people.map((person) => ({ handle: person.handle })); }
export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { handle } = await params; const person = people.find((item) => item.handle === handle);
  return { title: person ? `${person.name} — ProjectMatch` : "Student not found", description: person?.bio };
}

export default async function PublicProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params; const person = people.find((item) => item.handle === handle); if (!person) notFound();
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  return <main className="min-h-screen bg-[#f4f7fb] px-5 py-10 text-slate-950"><article className="mx-auto max-w-4xl overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-blue-100"><header className="bg-slate-950 p-7 text-white sm:p-10"><Link href="/people" className="text-sm font-semibold text-cyan-300">← SRM student directory</Link><div className="mt-8 flex flex-wrap items-center gap-5"><div className="grid h-24 w-24 place-items-center rounded-3xl bg-gradient-to-br from-blue-500 to-cyan-300 text-3xl font-bold text-slate-950" aria-hidden="true">{person.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</div><div><div className="flex flex-wrap items-center gap-2"><h1 className="text-4xl font-semibold">{person.name}</h1><span className="rounded-full bg-cyan-300 px-3 py-1 text-xs font-bold text-slate-950">Verified student</span></div><p className="mt-2 text-slate-300">{person.branch} · {person.year} · {campusName}</p></div></div></header><div className="grid gap-8 p-7 sm:p-10 lg:grid-cols-[1fr_300px]"><section><h2 className="text-xl font-semibold">About</h2><p className="mt-3 leading-7 text-slate-600">{person.bio}</p><h2 className="mt-8 text-xl font-semibold">Skills and interests</h2><div className="mt-3 flex flex-wrap gap-2">{person.skills.map((skill, index) => <span key={skill} className="rounded-full bg-blue-50 px-3 py-2 text-sm text-blue-800">{skill} · {Math.max(3, 5 - index)}/5</span>)}</div></section><aside><h2 className="text-xl font-semibold">Weekly availability</h2><p className="mt-2 text-sm text-slate-500">{person.freshness}</p><ul className="mt-4 space-y-2">{days.map((day, index) => <li key={day} className={`flex justify-between rounded-xl px-3 py-2 text-sm ${person.availableDays.includes(index) ? "bg-emerald-50 text-emerald-900" : "bg-slate-50 text-slate-500"}`}><span>{day}</span><span>{person.availableDays.includes(index) ? "Available" : "Unavailable"}</span></li>)}</ul><Link href={`/messages/${person.handle}`} className="mt-6 block rounded-full bg-blue-700 px-4 py-3 text-center font-semibold text-white">Message {person.name.split(" ")[0]}</Link></aside></div></article></main>;
}

