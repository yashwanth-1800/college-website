import Link from "next/link";

export default function NotFound() {
  return <main className="grid min-h-screen place-items-center bg-slate-950 p-6 text-center text-white"><div><p className="text-sm font-semibold text-cyan-300">404 · PROJECTMATCH</p><h1 className="mt-3 text-4xl font-semibold">That page is not on the team yet.</h1><p className="mt-3 text-slate-300">Browse active SRM student projects or return to the campus directory.</p><div className="mt-6 flex justify-center gap-3"><Link className="rounded-full bg-cyan-300 px-5 py-3 font-semibold text-slate-950" href="/projects">Browse projects</Link><Link className="rounded-full border border-white/20 px-5 py-3" href="/people">Browse people</Link></div></div></main>;
}
