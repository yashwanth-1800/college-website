import Link from "next/link";
import type { DemoPerson } from "@/lib/demo-data";
import type { MatchResult } from "@/lib/matching";
import { ScoreBreakdown } from "./ScoreBreakdown";

export function MatchCard({ person, result }: { person: DemoPerson; result: MatchResult }) {
  return <article className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-blue-700">{person.branch} · {person.year}</p><h2 className="mt-1 text-xl font-semibold"><Link className="hover:text-blue-700" href={`/u/${person.handle}`}>{person.name}</Link></h2></div><div className={`grid h-16 w-16 shrink-0 place-items-center rounded-2xl text-xl font-bold ${result.hardFilterFailed ? "bg-amber-100 text-amber-900" : "bg-slate-950 text-cyan-300"}`}><span aria-label={`${result.total} percent match`}>{result.total}</span></div></div><div className="mt-5"><ScoreBreakdown result={result} /></div><ul className="mt-5 space-y-2 text-sm text-slate-700">{result.explanation.slice(0, 3).map((reason) => <li className="flex gap-2" key={reason}><span aria-hidden="true" className="text-blue-600">✓</span>{reason}</li>)}</ul>{result.warnings.length > 0 ? <div role="note" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{result.warnings[0]}</div> : null}<div className="mt-5 flex flex-wrap gap-2"><Link href={`/u/${person.handle}`} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold">View profile</Link><Link href={`/messages/${person.handle}`} className="rounded-full bg-blue-700 px-4 py-2 text-sm font-semibold text-white">Message student</Link></div></article>;
}

