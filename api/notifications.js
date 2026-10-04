import { adminDb, adminMessaging, requireCampusUser, sendApiError } from "./_firebase-admin.js";
import { allowWebClient } from "./_cors.js";

const EVENT_MESSAGES = {
  "report-created": (report) => ({ title: `${report.priority} campus incident`, body: `${report.emergencyType} · ${report.location?.building || "Campus"}` }),
  "volunteer.claimed": (report) => ({ title: "Responder assigned", body: `${report.assignedVolunteerName || "A volunteer"} is responding to ${report.id}.` }),
  "incident.status": (report) => ({ title: "Incident status updated", body: `${report.id} is now ${report.status}.` }),
  "medical.resolved": (report) => ({ title: "Medical case resolved", body: `${report.id} has been marked resolved by a doctor.` }),
};

export default async function handler(request, response) {
  if (allowWebClient(request, response)) return;
  if (request.method !== "POST") return response.status(405).json({ error: "Method not allowed." });
  try {
    const actor = await requireCampusUser(request);
    const event = String(request.body?.event || "");
    const reportId = String(request.body?.reportId || "").slice(0, 80);
    if (!EVENT_MESSAGES[event] || !reportId) return response.status(400).json({ error: "Invalid notification event." });
    const reportSnapshot = await adminDb.collection("reports").doc(reportId).get();
    if (!reportSnapshot.exists) return response.status(404).json({ error: "Incident not found." });
    const report = reportSnapshot.data();
    const permitted = actor.profile.role === "Administrator"
      || (event === "report-created" && report.submittedByUid === actor.uid)
      || (event === "volunteer.claimed" && report.assignedVolunteerUid === actor.uid)
      || (event === "medical.resolved" && actor.profile.role === "Doctor" && report.emergencyType === "Medical");
    if (!permitted) return response.status(403).json({ error: "This notification is not permitted." });

    const userSnapshots = await Promise.all(
      (event === "report-created" ? ["Volunteer", "Doctor", "Administrator"] : ["Student", "Administrator"])
        .map((role) => adminDb.collection("users").where("role", "==", role).where("status", "==", "active").get()),
    );
    const recipientUids = new Set(userSnapshots.flatMap((snapshot) => snapshot.docs.map((item) => item.id)));
    recipientUids.add(report.submittedByUid);
    const subscriptionSnapshots = await Promise.all([...recipientUids].map((uid) => adminDb.collection("notificationSubscriptions").doc(uid).get()));
    const tokens = subscriptionSnapshots.filter((item) => item.exists && item.data().token).map((item) => item.data().token);
    const notification = EVENT_MESSAGES[event](report);
    if (tokens.length) await adminMessaging.sendEachForMulticast({ tokens: tokens.slice(0, 500), notification, webpush: { fcmOptions: { link: `https://campus-emergency-response.vercel.app/#dashboard/${actor.profile.role.toLowerCase()}` } } });
    await Promise.all([...recipientUids].map((uid) => adminDb.collection("notifications").add({ recipientUid: uid, reportId, event, ...notification, read: false, createdAt: new Date().toISOString() })));
    return response.status(200).json({ delivered: tokens.length, recorded: recipientUids.size });
  } catch (error) {
    return sendApiError(response, error);
  }
}

