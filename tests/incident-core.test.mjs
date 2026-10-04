import test from "node:test";
import assert from "node:assert/strict";
import "../incident-core.js";

const core = globalThis.CampusIncidentCore;
const location = { campus: "SRM Campus", building: "Tech Park", floor: "Floor 2", area: "Lab 204" };

test("deterministic rules classify obvious safety cases", () => {
  assert.equal(core.classifyPriority({ emergencyType: "Fire", description: "Small fire near a bin", location }), "Critical");
  assert.equal(core.classifyPriority({ emergencyType: "Other", description: "Exposed electrical wire is sparking", location }), "High");
  assert.equal(core.classifyPriority({ emergencyType: "Medical", description: "Student has a minor injury", location }), "Medium");
  assert.equal(core.classifyPriority({ emergencyType: "Other", description: "Non-urgent information only", location }), "Low");
});

test("summary fallback only shortens supplied description", () => {
  const description = "A possible electrical fault is making a repeated buzzing sound near the laboratory workbench. Students have moved away from the immediate area while waiting for help.";
  const summary = core.summarizeDescription(description);
  assert.ok(summary.length < description.length);
  assert.ok(description.startsWith(summary.replace(/…$/, "")));
});

test("legacy reports migrate without losing their identity", () => {
  const migrated = core.migrateReport({
    id: "ER-20260822-ABC123",
    emergencyType: "Medical",
    description: "Student requires medical assistance.",
    location: "Library",
    severity: "Medium",
    timestamp: "2026-08-22T15:03:00.000Z",
    reportStatus: "Pending",
    helperStatus: "Not yet",
    submittedBy: "student@example.com",
  });
  assert.equal(migrated.id, "ER-20260822-ABC123");
  assert.equal(migrated.location.building, "Library");
  assert.equal(migrated.status, "Reported");
  assert.equal(migrated.reportedAt, "2026-08-22T15:03:00.000Z");
});

test("timeline and analytics are derived from actual incident data", () => {
  const reported = core.migrateReport({
    id: "EMG-1",
    emergencyType: "Fire",
    description: "Smoke and fire reported in the room.",
    location,
    createdAt: "2026-09-21T10:00:00.000Z",
    status: "Reported",
    helperStatus: "Not yet",
  });
  const resolved = core.migrateReport({
    id: "EMG-2",
    emergencyType: "Other",
    description: "Non-urgent damaged chair requires inspection.",
    location,
    createdAt: "2026-09-21T11:00:00.000Z",
    status: "Resolved",
    resolvedAt: "2026-09-21T12:00:00.000Z",
    helperStatus: "Done",
  });
  const analytics = core.calculateAnalytics([reported, resolved], new Date("2026-09-22T12:00:00.000Z"));
  assert.equal(core.nextStatus("Reported"), "Acknowledged");
  assert.equal(analytics.total, 2);
  assert.equal(analytics.critical, 1);
  assert.equal(analytics.resolved, 1);
  assert.equal(analytics.hotspot.count, 2);
  assert.equal(analytics.averageResolutionMs, 60 * 60 * 1000);
});

test("production report metadata survives normalization", () => {
  const migrated = core.migrateReport({
    id: "EMG-20261004-PROD01",
    emergencyType: "Security",
    description: "Suspicious activity reported near the parking area.",
    location: { ...location, coordinates: { latitude: 12.823, longitude: 80.044, accuracyMeters: 18 } },
    createdAt: "2026-10-04T08:00:00.000Z",
    status: "Responding",
    helperStatus: "On it",
    submittedByUid: "student-1",
    assignedVolunteerUid: "volunteer-1",
    assignedVolunteerName: "Campus Volunteer",
    aiRecommendation: {
      priority: "High",
      summary: "Suspicious activity near parking.",
      confidence: 0.82,
      rationale: "Security risk requires prompt human review.",
      source: "server-ai",
    },
    attachments: [{ name: "evidence.jpg", type: "image/jpeg", size: 100, path: "reports/x/evidence.jpg", url: "https://example.test/evidence.jpg", uploadedAt: "2026-10-04T08:01:00.000Z" }],
  });
  assert.equal(migrated.location.coordinates.accuracyMeters, 18);
  assert.equal(migrated.assignedVolunteerUid, "volunteer-1");
  assert.equal(migrated.aiRecommendation.source, "server-ai");
  assert.equal(migrated.attachments.length, 1);
});

