"use client";

import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getFirebaseServices } from "@/lib/firebase/client";
import { saveCreatedProject, type StudentProject } from "@/lib/student-data";
import { projectInputSchema } from "@/lib/validation";

const projectTypes = ["Hackathon", "Startup", "Research", "Coursework", "Club initiative"];

export default function NewProjectPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [title, setTitle] = useState("");
  const [type, setType] = useState(projectTypes[0]);
  const [description, setDescription] = useState("");
  const [commitment, setCommitment] = useState("6 hrs/week");
  const [skills, setSkills] = useState("");
  const [roles, setRoles] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => onAuthStateChanged(getFirebaseServices().auth, (currentUser) => {
    if (!currentUser) router.replace("/signin");
    else setUser(currentUser);
  }), [router]);

  const createProject = async () => {
    const categories = skills.split(",").map((item) => item.trim()).filter(Boolean);
    const openRoles = roles.split(",").map((item) => item.trim()).filter(Boolean);
    const parsed = projectInputSchema.safeParse({ title, type, description, commitment, categories, openRoles });
    if (!user || !parsed.success) {
      setError(parsed.success ? "Sign in before publishing a project." : parsed.error.issues[0]?.message ?? "Check the project details.");
      return;
    }
    setBusy(true);
    setError("");
    const project: StudentProject = {
      id: `student-${crypto.randomUUID()}`,
      title: parsed.data.title, type: parsed.data.type, description: parsed.data.description,
      commitment: parsed.data.commitment, timezone: "Asia/Kolkata",
      categories: parsed.data.categories, openRoles: parsed.data.openRoles, roles: parsed.data.openRoles.length,
      ownerId: user.uid, ownerName: user.displayName ?? "SRM student",
      institution: "SRM University", createdAtMs: Date.now(),
    };
    saveCreatedProject(project);
    await setDoc(doc(getFirebaseServices().db, "projects", project.id), { ...project, createdAt: serverTimestamp() }, { merge: true }).catch(() => undefined);
    router.push(`/projects/${project.id}`);
  };

  return <main className="min-h-screen bg-[#f4f7fb] px-5 py-10 text-slate-950"><section className="mx-auto max-w-3xl rounded-3xl bg-white p-6 shadow-sm ring-1 ring-blue-100 sm:p-10"><Link href="/projects" className="text-sm font-semibold text-blue-700">← Explore projects</Link><p className="mt-8 text-sm font-semibold uppercase tracking-[.16em] text-blue-700">SRM student project</p><h1 className="mt-3 text-4xl font-semibold tracking-tight">Share your project idea</h1><p className="mt-3 text-slate-600">Describe the student teammates you need. Your project will appear in Explore Projects immediately.</p><div className="mt-8 grid gap-5 sm:grid-cols-2"><label className="font-medium sm:col-span-2">Project title<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={80} className="mt-2 block w-full rounded-xl border border-slate-300 p-3" placeholder="e.g. Smart Campus Navigation" /></label><label className="font-medium">Project type<select value={type} onChange={(event) => setType(event.target.value)} className="mt-2 block w-full rounded-xl border border-slate-300 p-3">{projectTypes.map((item) => <option key={item}>{item}</option>)}</select></label><label className="font-medium">Weekly commitment<input value={commitment} onChange={(event) => setCommitment(event.target.value)} maxLength={30} className="mt-2 block w-full rounded-xl border border-slate-300 p-3" /></label><label className="font-medium sm:col-span-2">Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} className="mt-2 min-h-32 w-full rounded-xl border border-slate-300 p-3" placeholder="What are you building and why does it matter?" /></label><label className="font-medium">Skills needed<input value={skills} onChange={(event) => setSkills(event.target.value)} className="mt-2 block w-full rounded-xl border border-slate-300 p-3" placeholder="React, UI/UX, Python" /><span className="mt-1 block text-xs font-normal text-slate-500">Separate skills with commas.</span></label><label className="font-medium">Open roles<input value={roles} onChange={(event) => setRoles(event.target.value)} className="mt-2 block w-full rounded-xl border border-slate-300 p-3" placeholder="Frontend Developer, Designer" /><span className="mt-1 block text-xs font-normal text-slate-500">Separate roles with commas.</span></label></div>{error ? <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}<button type="button" onClick={createProject} disabled={busy || !user} className="mt-8 w-full rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white disabled:opacity-60">{busy ? "Publishing project…" : "Publish student project"}</button></section></main>;
}
