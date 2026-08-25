"use client";

import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { collection, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc } from "firebase/firestore";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { people } from "@/lib/demo-data";
import { getFirebaseServices } from "@/lib/firebase/client";
import { conversationId, readDirectChat, saveDirectChat, type ChatMessage } from "@/lib/student-data";

export default function DirectMessagePage() {
  const { studentId } = useParams<{ studentId: string }>();
  const router = useRouter();
  const demoStudent = useMemo(() => people.find((person) => person.handle === studentId), [studentId]);
  const [user, setUser] = useState<User | null>(null);
  const [studentName, setStudentName] = useState(demoStudent?.name ?? "SRM student");
  const [studentContext, setStudentContext] = useState(demoStudent ? `${demoStudent.branch} · ${demoStudent.year}` : "SRM University student");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => onAuthStateChanged(getFirebaseServices().auth, (currentUser) => {
    if (!currentUser) router.replace("/signin");
    else setUser(currentUser);
  }), [router]);

  useEffect(() => onSnapshot(doc(getFirebaseServices().db, "users", studentId), (snapshot) => {
    if (!snapshot.exists()) return;
    const data = snapshot.data();
    setStudentName(typeof data.name === "string" ? data.name : "SRM student");
    setStudentContext(`${typeof data.course === "string" ? data.course : "SRM"} · ${typeof data.academicYear === "string" ? data.academicYear : "Student"}`);
  }, () => undefined), [studentId]);

  useEffect(() => {
    if (!user) return;
    const id = conversationId(user.uid, studentId);
    setMessages(readDirectChat(id));
    const messagesQuery = query(collection(getFirebaseServices().db, "conversations", id, "messages"), orderBy("createdAtMs", "asc"));
    return onSnapshot(messagesQuery, (snapshot) => {
      if (snapshot.empty) return;
      const remote = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as ChatMessage);
      setMessages(remote);
      saveDirectChat(id, remote);
    }, () => undefined);
  }, [studentId, user]);

  const sendMessage = async () => {
    const body = text.trim();
    if (!user || !body) return;
    const id = conversationId(user.uid, studentId);
    const message: ChatMessage = { id: crypto.randomUUID(), authorId: user.uid, authorName: user.displayName ?? "SRM student", body, createdAtMs: Date.now() };
    const nextMessages = [...messages, message];
    setMessages(nextMessages);
    saveDirectChat(id, nextMessages);
    setText("");
    setStatus("Message saved.");
    const { db } = getFirebaseServices();
    await Promise.all([
      setDoc(doc(db, "conversations", id), { participants: [user.uid, studentId], participantNames: { [user.uid]: user.displayName ?? "SRM student", [studentId]: studentName }, lastMessage: body, updatedAt: serverTimestamp() }, { merge: true }),
      setDoc(doc(db, "conversations", id, "messages", message.id), { ...message, createdAt: serverTimestamp() }),
    ]).catch(() => setStatus("Message saved on this device. Firebase sync will resume when available."));
  };

  if (!user) return <main className="grid min-h-screen place-items-center bg-slate-950 text-white">Opening conversation…</main>;
  return <main className="min-h-screen bg-[#f4f7fb] px-5 py-8 text-slate-950"><section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-blue-100"><header className="flex items-center gap-4 border-b border-slate-200 p-5"><Link href="/messages" aria-label="Back to student messages" className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-lg">←</Link><div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-400 font-semibold text-white">{studentName.split(" ").map((part) => part[0]).join("").slice(0, 2)}</div><div><h1 className="font-semibold">{studentName}</h1><p className="text-sm text-slate-500">{studentContext} · SRM Kattankulathur</p></div></header><div aria-live="polite" className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-5">{messages.length === 0 ? <div className="grid min-h-64 place-items-center text-center"><div><p className="font-semibold">Start a conversation with {studentName.split(" ")[0]}</p><p className="mt-1 text-sm text-slate-500">Messages are saved after you send them.</p></div></div> : messages.map((message) => <article className={`max-w-[80%] rounded-2xl p-3 ${message.authorId === user.uid ? "ml-auto bg-blue-700 text-white" : "bg-white ring-1 ring-slate-200"}`} key={message.id}><p className={`text-xs font-semibold ${message.authorId === user.uid ? "text-blue-100" : "text-blue-700"}`}>{message.authorName}</p><p className="mt-1 whitespace-pre-wrap text-sm">{message.body}</p><time className={`mt-2 block text-xs ${message.authorId === user.uid ? "text-blue-200" : "text-slate-400"}`}>{new Date(message.createdAtMs).toLocaleString("en-IN")}</time></article>)}</div><footer className="border-t border-slate-200 p-4"><label className="sr-only" htmlFor="direct-message">Message {studentName}</label><div className="flex items-end gap-3"><textarea id="direct-message" value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} maxLength={500} className="min-h-12 flex-1 resize-none rounded-2xl border border-slate-300 p-3" placeholder={`Message ${studentName.split(" ")[0]}…`} /><button type="button" onClick={sendMessage} disabled={!text.trim()} className="rounded-full bg-blue-700 px-5 py-3 font-semibold text-white disabled:opacity-50">Send</button></div><p role="status" className="mt-2 min-h-5 text-xs text-blue-700">{status}</p></footer></section></main>;
}
