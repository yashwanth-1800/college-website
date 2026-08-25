"use client";

import Link from "next/link";
import { collection, onSnapshot } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { campusShortName, projects } from "@/lib/demo-data";
import { getFirebaseServices } from "@/lib/firebase/client";
import { readCreatedProjects, type StudentProject } from "@/lib/student-data";

export default function ProjectsPage() {
  const [type, setType] = useState("All");
  const [skill, setSkill] = useState("");
  const [studentProjects, setStudentProjects] = useState<StudentProject[]>([]);

  useEffect(() => {
    setStudentProjects(readCreatedProjects());
    return onSnapshot(collection(getFirebaseServices().db, "projects"), (snapshot) => {
      const remote = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as StudentProject);
      setStudentProjects((local) => {
        const merged = new Map([...local, ...remote].map((project) => [project.id, project]));
        return [...merged.values()];
      });
    }, () => undefined);
  }, []);

  const allProjects = useMemo(() => [...studentProjects, ...projects], [studentProjects]);
  const results = useMemo(() => allProjects.filter((project) => (type === "All" || project.type === type) && (!skill || project.categories.join(" ").toLowerCase().includes(skill.toLowerCase()))), [allProjects, skill, type]);
  const projectTypes = useMemo(() => [...new Set(allProjects.map((project) => project.type))], [allProjects]);

  return <main className="min-h-screen bg-[#f4f7fb] px-5 py-10 text-slate-950 sm:px-10"><div className="mx-auto max-w-7xl"><nav className="flex flex-wrap items-center justify-between gap-3"><Link href="/dashboard" className="text-sm font-semibold text-blue-700">← SRM student dashboard</Link><div className="flex items-center gap-3"><Link href="/availability" className="text-sm font-semibold text-blue-700">2026 availability</Link><Link href="/projects/new" className="rounded-full bg-blue-700 px-4 py-2 text-sm font-semibold text-white">+ Add project</Link></div></nav><header className="mt-8 max-w-3xl"><p className="text-sm font-semibold uppercase tracking-[.18em] text-blue-700">SRM student project hub</p><h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Ideas built on campus</h1><p className="mt-4 text-lg text-slate-600">Discover student-led projects, apply to contribute, and continue the saved project discussion.</p></header><div className="mt-8 grid gap-3 rounded-3xl border border-blue-100 bg-white p-5 shadow-sm sm:grid-cols-2"><label className="font-medium">Project type<select className="mt-1 block w-full rounded-xl border p-3" value={type} onChange={(event) => setType(event.target.value)}><option>All</option>{projectTypes.map((value) => <option key={value}>{value}</option>)}</select></label><label className="font-medium">Skillset category<input className="mt-1 block w-full rounded-xl border p-3" placeholder="e.g. UI/UX" value={skill} onChange={(event) => setSkill(event.target.value)} /></label></div><section className="mt-6 grid gap-5 md:grid-cols-2">{results.map((project) => { const isStudentCreated = "ownerId" in project; return <article key={project.id} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-1 hover:shadow-xl hover:ring-blue-200"><p className="text-xs font-semibold uppercase tracking-[.14em] text-blue-700">Student project · {campusShortName}</p><div className="mt-4 flex justify-between gap-3"><div><p className="text-sm font-semibold text-amber-700">{project.type}</p><h2 className="mt-1 text-2xl font-semibold">{project.title}</h2>{isStudentCreated ? <p className="mt-1 text-sm text-slate-500">Created by {project.ownerName}</p> : null}</div><span className="h-fit rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-800">{project.roles} open roles</span></div><p className="mt-3 leading-7 text-slate-600">{project.description}</p><div className="mt-5 flex flex-wrap gap-2">{project.categories.map((category) => <span key={category} className="rounded-full bg-cyan-50 px-3 py-1 text-sm text-cyan-900">Needs {category}</span>)}</div><p className="mt-5 text-sm text-slate-500">{project.timezone} · {project.commitment}</p><Link href={`/projects/${project.id}`} className="mt-5 inline-flex rounded-full bg-slate-950 px-4 py-2 font-semibold text-white">Open project and chat →</Link></article>; })}</section>{results.length === 0 ? <section className="mt-8 rounded-3xl border border-dashed bg-white p-10 text-center"><h2 className="font-semibold">No student projects match these filters</h2><button className="mt-3 rounded-full bg-blue-700 px-4 py-2 text-white" onClick={() => { setType("All"); setSkill(""); }}>Clear filters</button></section> : null}</div></main>;
}
