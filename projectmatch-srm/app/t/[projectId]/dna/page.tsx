import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { projects } from "@/lib/demo-data";

export const revalidate = 3600;
export function generateStaticParams() { return projects.map((project) => ({ projectId: project.id })); }
export async function generateMetadata({ params }: { params: Promise<{ projectId: string }> }): Promise<Metadata> {
  const { projectId } = await params; const project = projects.find((item) => item.id === projectId);
  return { title: project ? `${project.title} Team DNA — ProjectMatch` : "Team not found", description: project ? `Skill coverage and open roles for ${project.title}.` : undefined };
}

export default async function TeamDnaPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params; const project = projects.find((item) => item.id === projectId); if (!project) notFound();
  const coverage = Math.max(42, 88 - project.roles * 9);
  return <main className="grid min-h-screen place-items-center bg-slate-950 p-5 text-white"><article className="w-full max-w-4xl overflow-hidden rounded-[2rem] border border-white/15 bg-white/5 shadow-2xl"><header className="bg-gradient-to-br from-blue-700 to-cyan-500 p-8 text-slate-950 sm:p-12"><p className="text-sm font-bold uppercase tracking-[.18em]">ProjectMatch · Team DNA</p><h1 className="mt-3 text-4xl font-semibold sm:text-5xl">{project.title}</h1><p className="mt-3 max-w-2xl text-slate-900">{project.description}</p></header><div className="grid gap-8 p-8 sm:p-12 lg:grid-cols-[260px_1fr]"><div className="grid aspect-square place-items-center rounded-full border-[18px] border-cyan-300 bg-slate-900"><div className="text-center"><strong className="text-5xl text-cyan-300">{coverage}%</strong><span className="mt-1 block text-sm text-slate-300">skill coverage</span></div></div><section><h2 className="text-2xl font-semibold">The missing pieces</h2><div className="mt-4 flex flex-wrap gap-2">{project.categories.map((category) => <span className="rounded-full bg-white/10 px-3 py-2 text-sm" key={category}>{category}</span>)}</div><dl className="mt-7 grid gap-4 sm:grid-cols-3"><div><dt className="text-xs uppercase text-slate-400">Open roles</dt><dd className="mt-1 text-xl font-semibold">{project.roles}</dd></div><div><dt className="text-xs uppercase text-slate-400">Timezone</dt><dd className="mt-1 font-semibold">{project.timezone}</dd></div><div><dt className="text-xs uppercase text-slate-400">Commitment</dt><dd className="mt-1 font-semibold">{project.commitment}</dd></div></dl><div className="mt-8 flex flex-wrap gap-3"><Link href={`/projects/${project.id}`} className="rounded-full bg-cyan-300 px-5 py-3 font-semibold text-slate-950">Join this student team</Link><Link href={`/projects/${project.id}/matches`} className="rounded-full border border-white/20 px-5 py-3 font-semibold">See team matches</Link></div></section></div></article></main>;
}

