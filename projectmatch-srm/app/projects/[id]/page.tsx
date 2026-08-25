"use client";

import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { collection, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc } from "firebase/firestore";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { DemoProject } from "@/lib/demo-data";
import { campusName, projects } from "@/lib/demo-data";
import { getFirebaseServices } from "@/lib/firebase/client";
import { readChat, readCreatedProjects, saveChat, type ChatMessage, type StudentProject } from "@/lib/student-data";
import { applicationInputSchema, messageInputSchema } from "@/lib/validation";

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = useState<DemoProject | StudentProject | undefined>(() => projects.find((item) => item.id === id));
  const [loaded, setLoaded] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState("");
  const [note, setNote] = useState("");
  const [applicationStatus, setApplicationStatus] = useState<"idle" | "applied">("idle");
  const [applicationMessage, setApplicationMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatText, setChatText] = useState("");
  const [chatStatus, setChatStatus] = useState("");

  useEffect(() => {
    const { auth, db } = getFirebaseServices();
    setProject(projects.find((item) => item.id === id) ?? readCreatedProjects().find((item) => item.id === id));
    setMessages(readChat(id));
    setApplicationStatus(localStorage.getItem(`projectmatch-application-${id}`) ? "applied" : "idle");
    setLoaded(true);
    const stopAuth = onAuthStateChanged(auth, setUser);
    const stopProject = onSnapshot(doc(db, "projects", id), (snapshot) => {
      if (snapshot.exists()) setProject({ id: snapshot.id, ...snapshot.data() } as StudentProject);
    }, () => undefined);
    const messagesQuery = query(collection(db, "projects", id, "messages"), orderBy("createdAtMs", "asc"));
    const stopMessages = onSnapshot(messagesQuery, (snapshot) => {
      if (snapshot.empty) return;
      const remote = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as ChatMessage);
      setMessages(remote);
      saveChat(id, remote);
    }, () => undefined);
    return () => { stopAuth(); stopProject(); stopMessages(); };
  }, [id]);

  if (!loaded) return <main className="grid min-h-screen place-items-center bg-slate-950 text-white">Loading project…</main>;
  if (!project) return <main className="grid min-h-screen place-items-center bg-[#f4f7fb] p-6 text-center"><div><h1 className="text-2xl font-semibold">Project not found</h1><Link className="mt-4 inline-block text-blue-700" href="/projects">Browse available projects</Link></div></main>;

  const apply = async () => {
    const { auth, db } = getFirebaseServices();
    if (!auth.currentUser) { router.push(`/signin?next=/projects/${project.id}`); return; }
    const parsed = applicationInputSchema.safeParse({ role, note });
    if (!parsed.success) { setApplicationMessage(parsed.error.issues[0]?.message ?? "Check your application."); return; }
    const application = { projectId: project.id, projectTitle: project.title, role: parsed.data.role, note: parsed.data.note, status: "PENDING", applicantId: auth.currentUser.uid, applicantName: auth.currentUser.displayName, applicantEmail: auth.currentUser.email };
    localStorage.setItem(`projectmatch-application-${project.id}`, JSON.stringify(application));
    await setDoc(doc(db, "applications", `${auth.currentUser.uid}_${project.id}`), { ...application, createdAt: serverTimestamp() }, { merge: true }).catch(() => undefined);
    setApplicationStatus("applied");
    setApplicationMessage("Application submitted. The student owner can now review your profile.");
  };

  const sendMessage = async () => {
    const parsed = messageInputSchema.safeParse(chatText);
    if (!user) { router.push(`/signin?next=/projects/${project.id}`); return; }
    if (!parsed.success) { setChatStatus("Write a message of up to 500 characters."); return; }
    const body = parsed.data;
    const message: ChatMessage = { id: crypto.randomUUID(), authorId: user.uid, authorName: user.displayName ?? "SRM student", body, createdAtMs: Date.now() };
    const nextMessages = [...messages, message];
    setMessages(nextMessages);
    saveChat(project.id, nextMessages);
    setChatText("");
    setChatStatus("Message saved.");
    await setDoc(doc(getFirebaseServices().db, "projects", project.id, "messages", message.id), { ...message, createdAt: serverTimestamp() }).catch(() => {
      setChatStatus("Message saved on this device. Firebase sync will retry when available.");
    });
  };

  const ownerName = "ownerName" in project ? project.ownerName : "SRM student team";
  return <main className="min-h-screen bg-[#f4f7fb] px-5 py-10 text-slate-950 sm:px-10"><div className="mx-auto max-w-6xl"><Link href="/projects" className="text-sm font-semibold text-blue-700">← All student projects</Link><section className="mt-6 grid gap-8 lg:grid-cols-[1fr_360px]"><div className="space-y-8"><article className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-blue-100"><p className="text-xs font-semibold uppercase tracking-[.15em] text-blue-700">Student project · {campusName}</p><p className="mt-4 text-sm font-semibold uppercase tracking-widest text-amber-700">{project.type}</p><h1 className="mt-3 text-4xl font-semibold tracking-tight">{project.title}</h1><p className="mt-2 text-sm text-slate-500">Created by {ownerName}</p><p className="mt-5 text-lg leading-8 text-slate-600">{project.description}</p><dl className="mt-7 grid gap-4 sm:grid-cols-3"><div><dt className="text-xs uppercase text-slate-500">Commitment</dt><dd className="mt-1 font-semibold">{project.commitment}</dd></div><div><dt className="text-xs uppercase text-slate-500">Timezone</dt><dd className="mt-1 font-semibold">{project.timezone}</dd></div><div><dt className="text-xs uppercase text-slate-500">Open roles</dt><dd className="mt-1 font-semibold">{project.roles}</dd></div></dl><h2 className="mt-9 text-xl font-semibold">Skills this student team needs</h2><div className="mt-3 flex flex-wrap gap-2">{project.categories.map((item) => <span className="rounded-full bg-blue-50 px-3 py-1.5 text-sm text-blue-800" key={item}>{item}</span>)}</div></article><section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200"><div className="flex items-end justify-between gap-3"><div><p className="text-sm font-semibold text-blue-700">SAVED PROJECT CHAT</p><h2 className="mt-1 text-2xl font-semibold">Student discussion</h2></div><span className="text-sm text-slate-500">{messages.length} messages</span></div><div aria-live="polite" className="mt-5 max-h-96 space-y-3 overflow-y-auto rounded-2xl bg-slate-50 p-4">{messages.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">Start the conversation about this project.</p> : messages.map((item) => <article className={`max-w-[85%] rounded-2xl p-3 ${item.authorId === user?.uid ? "ml-auto bg-blue-700 text-white" : "bg-white ring-1 ring-slate-200"}`} key={item.id}><p className={`text-xs font-semibold ${item.authorId === user?.uid ? "text-blue-100" : "text-blue-700"}`}>{item.authorName}</p><p className="mt-1 whitespace-pre-wrap text-sm">{item.body}</p><time className={`mt-2 block text-xs ${item.authorId === user?.uid ? "text-blue-200" : "text-slate-400"}`}>{new Date(item.createdAtMs).toLocaleString("en-IN")}</time></article>)}</div><label className="mt-5 block text-sm font-medium">Message<textarea value={chatText} onChange={(event) => setChatText(event.target.value)} maxLength={500} placeholder={user ? "Write a message to the student team…" : "Sign in to join the discussion"} className="mt-2 min-h-24 w-full rounded-xl border border-slate-300 p-3" /></label><div className="mt-3 flex flex-wrap items-center gap-3"><button type="button" onClick={sendMessage} className="rounded-full bg-blue-700 px-5 py-2.5 font-semibold text-white">{user ? "Send and save" : "Sign in to chat"}</button><p role="status" className="text-sm text-blue-700">{chatStatus}</p></div></section></div><aside className="h-fit rounded-3xl bg-slate-950 p-6 text-white"><h2 className="text-2xl font-semibold">Apply to join</h2><p className="mt-2 text-sm text-slate-300">Choose where you can contribute. Your profile and saved availability help the student owner decide.</p><label className="mt-6 block text-sm font-medium">Role<select value={role} onChange={(event) => setRole(event.target.value)} disabled={applicationStatus === "applied"} className="mt-2 w-full rounded-xl border border-white/20 bg-slate-900 p-3"><option value="">Choose a role</option>{project.openRoles.map((item) => <option key={item}>{item}</option>)}</select></label><label className="mt-5 block text-sm font-medium">Message to the team<textarea value={note} onChange={(event) => setNote(event.target.value)} disabled={applicationStatus === "applied"} maxLength={400} placeholder="Tell them how you can help…" className="mt-2 min-h-28 w-full rounded-xl border border-white/20 bg-slate-900 p-3" /></label><button onClick={apply} disabled={applicationStatus === "applied"} className="mt-5 w-full rounded-xl bg-cyan-300 px-4 py-3 font-semibold text-slate-950 disabled:bg-cyan-100">{applicationStatus === "applied" ? "Application submitted ✓" : "Submit application"}</button><p role="status" className="mt-4 text-sm text-cyan-200">{applicationMessage}</p></aside></section></div></main>;
}
