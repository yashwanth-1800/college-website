import { adminDb, adminMessaging, sendApiError } from "./_firebase-admin.js";

const TARGET_MINUTES = { Critical: 5, High: 10, Medium: 20, Low: 45 };

export default async function handler(request, response) {
  if (request.method !== "GET") return response.status(405).json({ error: "Method not allowed." });
  try {
    if (!process.env.CRON_SECRET || request.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) return response.status(401).json({ error: "Unauthorized." });
    const snapshot = await adminDb.collection("reports").where("reportStatus", "==", "Pending").get();
    const now = Date.now();
    let escalated = 0;
    for (const reportDocument of snapshot.docs) {
      const report = reportDocument.data();
      const target = TARGET_MINUTES[report.priority] || 45;
      const ageMinutes = (now - Date.parse(report.createdAt)) / 60000;
      if (ageMinutes < target || report.escalatedAt) continue;
      const batch = adminDb.batch();
      batch.update(reportDocument.ref, { escalatedAt: new Date().toISOString(), escalationReason: `Response target exceeded (${target} minutes)`, updatedAt: new Date().toISOString() });
      batch.set(reportDocument.ref.collection("audit").doc(), { action: "sla.escalated", message: `Automatic escalation after ${target} minutes`, actorUid: "system", actorName: "Escalation service", actorRole: "System", createdAt: new Date().toISOString() });
      await batch.commit();
      escalated += 1;
    }
    if (escalated) {
      const subscriptions = await adminDb.collection("notificationSubscriptions").get();
      const tokens = subscriptions.docs.map((item) => item.data().token).filter(Boolean).slice(0, 500);
      if (tokens.length) await adminMessaging.sendEachForMulticast({ tokens, notification: { title: "Campus response escalation", body: `${escalated} incident${escalated === 1 ? " requires" : "s require"} immediate coordinator review.` } });
    }
    return response.status(200).json({ checked: snapshot.size, escalated });
  } catch (error) {
    return sendApiError(response, error);
  }
}

