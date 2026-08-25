"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { MatchCard } from "@/components/MatchCard";
import { projects } from "@/lib/demo-data";
import { demoMatches } from "@/lib/matching/demo";

export default function ProjectMatchesPage() {
  const { id } = useParams<{ id: string }>();
  const [showUnavailable, setShowUnavailable] = useState(false);
  const matches = useMemo(() => demoMatches(id), [id]);
  const project = projects.find((item) => item.id === id) ?? projects[0];
  const visible = showUnavailable ? matches : matches.filter((item) => !item.result.hardFilterFailed);
  return <main className="min-h-screen bg-[#f4f7fb] px-5 py-10 text-slate-950 sm:px-10"><div className="mx-auto max-w-6xl"><Link href={`/projects/${id}`} className="text-sm font-semibold text-blue-700">← {project.title}</Link><header className="mt-7 flex flex-wrap items-end justify-between gap-5"><div className="max-w-3xl"><p className="text-sm font-semibold uppercase tracking-[.16em] text-blue-700">Explainable complementarity ranking</p><h1 className="mt-2 text-4xl font-semibold">Students who complete this team</h1><p className="mt-3 text-slate-600">Ranked by missing-skill coverage and shared availability—not profile similarity. Every score shows its evidence.</p></div><label className="flex cursor-pointer items-center gap-3 rounded-full bg-white px-4 py-3 text-sm font-medium ring-1 ring-slate-200"><input type="checkbox" checked={showUnavailable} onChange={(event) => setShowUnavailable(event.target.checked)} /> Show unavailable matches</label></header><p role="status" className="mt-7 text-sm text-slate-600">Showing {visible.length} of {matches.length} ranked students</p><section className="mt-4 grid gap-5 lg:grid-cols-2">{visible.map((match) => <MatchCard key={match.person.handle} person={match.person} result={match.result} />)}</section></div></main>;
}

