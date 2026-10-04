import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";
import {
  getDownloadURL,
  ref,
  uploadBytes,
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-storage.js";
import { app, db, storage } from "./firebase-services.js";

const LOCAL_FALLBACK_KEY = "campusEmergencyReports";
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "audio/mpeg", "audio/webm", "application/pdf",
]);
const ROLE_VALUES = ["Student", "Volunteer", "Doctor", "Administrator"];
let unsubscribeReports = null;
let unsubscribeUsers = null;
let lastReportFingerprints = new Map();

const currentSession = () => window.Auth?.getSession?.() || null;
const isLocalQa = () => ["127.0.0.1", "localhost"].includes(window.location.hostname) && currentSession()?.uid?.startsWith("qa-");
const nowIso = () => new Date().toISOString();

function normalizeDocument(snapshot) {
  const value = snapshot.data();
  return window.CampusIncidentCore.migrateReport({ id: snapshot.id, ...value }) || value;
}

function auditRecord(action, message, extra = {}) {
  const session = currentSession();
  return {
    action,
    message,
    actorUid: session?.uid || "unknown",
    actorName: session?.name || "Campus user",
    actorEmail: session?.email || "",
    actorRole: session?.role || "Unknown",
    createdAt: nowIso(),
    createdAtServer: serverTimestamp(),
    ...extra,
  };
}

function localReports() {
  try {
    const value = JSON.parse(localStorage.getItem(LOCAL_FALLBACK_KEY) || "[]");
    return Array.isArray(value) ? value.map(window.CampusIncidentCore.migrateReport).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function saveLocalReports(nextReports) {
  localStorage.setItem(LOCAL_FALLBACK_KEY, JSON.stringify(nextReports));
  window.dispatchEvent(new CustomEvent("data-local-change", { detail: nextReports }));
}

function maybeNotify(previous, next) {
  if (document.visibilityState === "visible" || Notification.permission !== "granted") return;
  const session = currentSession();
  if (!session || session.role === "Student") return;
  if (!previous && next) {
    new Notification(`${next.priority || "New"} campus incident`, {
      body: `${next.emergencyType}: ${next.summary || next.description}`,
      tag: next.id,
    });
  } else if (previous && previous.status !== next.status) {
    new Notification(`Incident ${next.id} updated`, { body: `Status: ${next.status}`, tag: next.id });
  }
}

function subscribeReports(onReports, onState) {
  unsubscribeReports?.();
  const session = currentSession();
  if (!session) {
    onReports([]);
    return () => {};
  }
  if (isLocalQa()) {
    onReports(localReports());
    onState?.({ online: navigator.onLine, source: "local QA data" });
    return () => {};
  }

  const base = collection(db, "reports");
  const reportsQuery = session.role === "Student"
    ? query(base, where("submittedByUid", "==", session.uid))
    : session.role === "Doctor"
      ? query(base, where("emergencyType", "==", "Medical"))
      : query(base);

  unsubscribeReports = onSnapshot(reportsQuery, { includeMetadataChanges: true }, (snapshot) => {
    const nextReports = snapshot.docs.map(normalizeDocument);
    const nextFingerprints = new Map();
    nextReports.forEach((report) => {
      const fingerprint = `${report.status}|${report.helperStatus}|${report.updatedAt}`;
      nextFingerprints.set(report.id, fingerprint);
      const previousFingerprint = lastReportFingerprints.get(report.id);
      if (previousFingerprint !== fingerprint) maybeNotify(previousFingerprint ? { status: previousFingerprint.split("|")[0] } : null, report);
    });
    lastReportFingerprints = nextFingerprints;
    onReports(nextReports);
    onState?.({
      online: navigator.onLine,
      pendingWrites: snapshot.metadata.hasPendingWrites,
      source: snapshot.metadata.fromCache ? "offline cache" : "Firestore",
    });
  }, (error) => onState?.({ online: navigator.onLine, error: error.message, source: "Firestore" }));
  return () => unsubscribeReports?.();
}

async function createReport(report, attachment) {
  const session = currentSession();
  if (!session || session.role !== "Student") throw new Error("Only an assigned Student account can submit reports.");
  if (isLocalQa()) {
    const next = [...localReports(), report];
    saveLocalReports(next);
    return report;
  }

  const reportReference = doc(db, "reports", report.id);
  const auditReference = doc(collection(reportReference, "audit"));
  const batch = writeBatch(db);
  const cloudReport = {
    ...report,
    submittedByUid: session.uid,
    submittedBy: session.email,
    submittedByName: session.name,
    createdAtServer: serverTimestamp(),
    updatedAtServer: serverTimestamp(),
    attachments: [],
    version: 1,
  };
  batch.set(reportReference, cloudReport);
  batch.set(auditReference, auditRecord("report.created", "Emergency report submitted", {
    toStatus: "Reported",
    toPriority: report.priority,
  }));
  await batch.commit();

  if (attachment) await uploadAttachment(report.id, attachment);
  callNotificationApi("report-created", report.id).catch(() => {});
  return cloudReport;
}

async function uploadAttachment(reportId, file) {
  const session = currentSession();
  if (!session || session.role !== "Student") throw new Error("Only the reporting student can upload an attachment.");
  if (!ALLOWED_ATTACHMENT_TYPES.has(file.type)) throw new Error("Use a JPG, PNG, WebP, MP3, WebM, or PDF attachment.");
  if (file.size > MAX_ATTACHMENT_BYTES) throw new Error("Attachments must be 10 MB or smaller.");
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
  const objectPath = `reports/${reportId}/${crypto.randomUUID()}-${safeName}`;
  const objectReference = ref(storage, objectPath);
  await uploadBytes(objectReference, file, { contentType: file.type, customMetadata: { reportId, ownerUid: session.uid } });
  const url = await getDownloadURL(objectReference);
  const attachment = { name: safeName, type: file.type, size: file.size, path: objectPath, url, uploadedAt: nowIso() };
  const reportReference = doc(db, "reports", reportId);
  const auditReference = doc(collection(reportReference, "audit"));
  const batch = writeBatch(db);
  batch.update(reportReference, { attachments: arrayUnion(attachment), updatedAt: nowIso(), updatedAtServer: serverTimestamp() });
  batch.set(auditReference, auditRecord("attachment.added", `Attachment added: ${safeName}`));
  await batch.commit();
  return attachment;
}

async function mutateReport(reportId, changes, action, message, auditExtra = {}) {
  if (isLocalQa()) {
    const current = localReports();
    const index = current.findIndex((report) => report.id === reportId);
    if (index < 0) throw new Error("This incident no longer exists.");
    current[index] = { ...current[index], ...changes, updatedAt: nowIso(), version: (current[index].version || 0) + 1 };
    saveLocalReports(current);
    return;
  }
  const reportReference = doc(db, "reports", reportId);
  const auditReference = doc(collection(reportReference, "audit"));
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reportReference);
    if (!snapshot.exists()) throw new Error("This incident no longer exists.");
    transaction.update(reportReference, {
      ...changes,
      updatedAt: nowIso(),
      updatedAtServer: serverTimestamp(),
      version: (snapshot.data().version || 0) + 1,
    });
    transaction.set(auditReference, auditRecord(action, message, auditExtra));
  });
  callNotificationApi(action, reportId).catch(() => {});
}

async function updateHelperStatus(reportId, helperStatus) {
  const session = currentSession();
  if (session?.role !== "Volunteer") throw new Error("Only volunteers can update response tasks.");
  if (!window.CampusIncidentCore.HELPER_STATUSES.includes(helperStatus)) throw new Error("Invalid helper status.");
  await mutateReport(reportId, {
    helperStatus,
    helperUpdatedAt: nowIso(),
    helperUpdatedByUid: session.uid,
    helperUpdatedByName: session.name,
  }, "volunteer.status", `Volunteer task changed to ${helperStatus}`, { toHelperStatus: helperStatus });
}

async function claimReport(reportId) {
  const session = currentSession();
  if (session?.role !== "Volunteer") throw new Error("Only volunteers can claim incidents.");
  if (isLocalQa()) {
    const current = localReports();
    const report = current.find((item) => item.id === reportId);
    if (!report) throw new Error("This incident no longer exists.");
    if (report.assignedVolunteerUid && report.assignedVolunteerUid !== session.uid) throw new Error("Another volunteer has already claimed this incident.");
    Object.assign(report, {
      assignedVolunteerUid: session.uid,
      assignedVolunteerName: session.name,
      assignedVolunteerEmail: session.email,
      assignedAt: report.assignedAt || nowIso(),
      helperStatus: "On it",
      helperUpdatedAt: nowIso(),
      helperUpdatedByUid: session.uid,
      helperUpdatedByName: session.name,
      updatedAt: nowIso(),
    });
    saveLocalReports(current);
    return;
  }
  const reportReference = doc(db, "reports", reportId);
  const auditReference = doc(collection(reportReference, "audit"));
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reportReference);
    if (!snapshot.exists()) throw new Error("This incident no longer exists.");
    const report = snapshot.data();
    if (report.assignedVolunteerUid && report.assignedVolunteerUid !== session.uid) throw new Error("Another volunteer has already claimed this incident.");
    if (report.status === "Resolved") throw new Error("Resolved incidents cannot be claimed.");
    transaction.update(reportReference, {
      assignedVolunteerUid: session.uid,
      assignedVolunteerName: session.name,
      assignedVolunteerEmail: session.email,
      assignedAt: report.assignedAt || nowIso(),
      helperStatus: "On it",
      helperUpdatedAt: nowIso(),
      helperUpdatedByUid: session.uid,
      helperUpdatedByName: session.name,
      updatedAt: nowIso(),
      updatedAtServer: serverTimestamp(),
      version: (report.version || 0) + 1,
    });
    transaction.set(auditReference, auditRecord("volunteer.claimed", "Volunteer accepted responsibility", { toHelperStatus: "On it" }));
  });
  callNotificationApi("volunteer.claimed", reportId).catch(() => {});
}

async function releaseReport(reportId) {
  const session = currentSession();
  if (session?.role !== "Volunteer") throw new Error("Only volunteers can release assignments.");
  await mutateReport(reportId, {
    assignedVolunteerUid: null,
    assignedVolunteerName: null,
    assignedVolunteerEmail: null,
    assignedAt: null,
    helperStatus: "Not yet",
    helperUpdatedAt: nowIso(),
    helperUpdatedByUid: session.uid,
    helperUpdatedByName: session.name,
  }, "volunteer.released", "Volunteer released the assignment", { toHelperStatus: "Not yet" });
}

async function addResponderNote(reportId, note) {
  const session = currentSession();
  if (!session || !["Volunteer", "Doctor", "Administrator"].includes(session.role)) throw new Error("Your role cannot add responder notes.");
  const cleanNote = String(note || "").replace(/\s+/g, " ").trim().slice(0, 500);
  if (cleanNote.length < 3) throw new Error("Enter a responder note of at least 3 characters.");
  await addDoc(collection(db, "reports", reportId, "notes"), {
    note: cleanNote,
    authorUid: session.uid,
    authorName: session.name,
    authorRole: session.role,
    createdAt: nowIso(),
    createdAtServer: serverTimestamp(),
  });
  await addDoc(collection(db, "reports", reportId, "audit"), auditRecord("note.added", "Internal responder note added"));
}

async function getAuditHistory(reportId) {
  if (isLocalQa()) return [];
  const snapshot = await getDocs(query(collection(db, "reports", reportId, "audit"), orderBy("createdAt", "desc"), limit(30)));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

async function getResponderNotes(reportId) {
  if (isLocalQa()) return [];
  const snapshot = await getDocs(query(collection(db, "reports", reportId, "notes"), orderBy("createdAt", "desc"), limit(20)));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

async function requestAiRecommendation(input) {
  const token = await window.Auth.getIdToken();
  if (!token) throw new Error("Sign in before requesting an AI recommendation.");
  const response = await fetch("/api/recommendation", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || "AI recommendation unavailable.");
  return response.json();
}

async function callNotificationApi(event, reportId) {
  const token = await window.Auth.getIdToken();
  if (!token) return;
  await fetch("/api/notifications", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ event, reportId }),
  });
}

async function requestNotifications() {
  if (!("Notification" in window)) throw new Error("This browser does not support notifications.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notification permission was not granted.");
  const vapidKey = import.meta.env?.VITE_FIREBASE_VAPID_KEY;
  if (!vapidKey || isLocalQa()) return { browserOnly: true };
  const [{ getMessaging, getToken }, registration] = await Promise.all([
    import("https://www.gstatic.com/firebasejs/11.8.1/firebase-messaging.js"),
    navigator.serviceWorker.register("/firebase-messaging-sw.js"),
  ]);
  const token = await getToken(getMessaging(app), { vapidKey, serviceWorkerRegistration: registration });
  const session = currentSession();
  await setDoc(doc(db, "notificationSubscriptions", session.uid), {
    uid: session.uid,
    role: session.role,
    token,
    updatedAt: serverTimestamp(),
  }, { merge: true });
  return { browserOnly: false };
}

function subscribeUsers(onUsers, onError) {
  unsubscribeUsers?.();
  if (currentSession()?.role !== "Administrator" || isLocalQa()) {
    onUsers([]);
    return () => {};
  }
  unsubscribeUsers = onSnapshot(query(collection(db, "users"), orderBy("displayName")), (snapshot) => {
    onUsers(snapshot.docs.map((item) => item.data()));
  }, onError);
  return () => unsubscribeUsers?.();
}

async function setUserRole(uid, role) {
  if (currentSession()?.role !== "Administrator") throw new Error("Only administrators can assign roles.");
  if (!ROLE_VALUES.includes(role)) throw new Error("Invalid role.");
  await updateDoc(doc(db, "users", uid), {
    role,
    roleAssignedBy: currentSession().uid,
    roleAssignedAt: nowIso(),
    updatedAt: serverTimestamp(),
  });
  await addDoc(collection(db, "systemAudit"), auditRecord("user.role", `User role changed to ${role}`, { targetUid: uid, toRole: role }));
}

window.Data = {
  addResponderNote,
  claimReport,
  createReport,
  getAuditHistory,
  getResponderNotes,
  releaseReport,
  requestAiRecommendation,
  requestNotifications,
  setUserRole,
  subscribeReports,
  subscribeUsers,
  updateHelperStatus,
  mutateReport,
};

window.dispatchEvent(new Event("data-module-ready"));

