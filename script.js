"use strict";

const STORAGE_KEY = "campusEmergencyReports";
const Core = window.CampusIncidentCore;
const {
  EMERGENCY_TYPES,
  HELPER_STATUSES,
  INCIDENT_STATUSES,
  PRIORITIES,
  calculateAnalytics,
  classifyPriority,
  formatLocation,
  migrateReport,
  nextStatus,
  priorityToSeverity,
  summarizeDescription,
} = Core;

const VOLUNTEER_GUIDANCE = {
  Critical: "Alert campus security and medical staff immediately; do not delay.",
  High: "Coordinate directly with responders and bring assistance urgently.",
  Medium: "Assess the student or area and escort them to the appropriate campus service.",
  Low: "Check the location and provide routine on-site assistance.",
};
const STATUS_TIMESTAMP_FIELDS = {
  Reported: "reportedAt",
  Acknowledged: "acknowledgedAt",
  Responding: "respondingAt",
  Resolved: "resolvedAt",
};
const RESPONSE_MESSAGES = {
  Reported: "Your report has been received and is awaiting acknowledgement.",
  Acknowledged: "Campus responders have acknowledged your report.",
  Responding: "Responders are currently handling your report.",
  Resolved: "This incident has been marked resolved.",
};

const $ = (selector) => document.querySelector(selector);
let persistenceWarning = "";
let reports = loadReports();
let filters = { priority: "All", status: "All", helperStatus: "All", emergencyType: "All" };
let reportSubmissionInProgress = false;
let googleSignInInProgress = false;
let appStarted = false;
let trackedReportId = "";
let capturedCoordinates = null;
let reportSubscription = null;
let userSubscription = null;
let subscribedSessionKey = "";
let managedUsers = [];

function showMessage(selector, message, kind = "success") {
  const element = $(selector);
  if (!element) return;
  element.textContent = message;
  element.className = `status-message ${kind}`;
}

function getSession() {
  return window.Auth?.getSession() || null;
}

function isAllowed(action) {
  const role = getSession()?.role;
  return {
    submit: role === "Student",
    updateHelper: role === "Volunteer",
    resolveMedical: role === "Doctor",
    updateStatus: role === "Administrator",
    overridePriority: role === "Administrator",
  }[action] === true;
}

function loadReports() {
  try {
    const storedValue = localStorage.getItem(STORAGE_KEY);
    if (!storedValue) return [];
    const parsedValue = JSON.parse(storedValue);
    if (!Array.isArray(parsedValue)) return [];

    const migrated = parsedValue.map(migrateReport).filter(Boolean);
    if (JSON.stringify(migrated) !== JSON.stringify(parsedValue)) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    }
    return migrated;
  } catch {
    persistenceWarning = "Saved incident data could not be read. This session will start with an empty incident list.";
    return [];
  }
}

function saveReports(nextReports) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextReports));
    reports = nextReports;
    return true;
  } catch {
    showMessage("#app-status", "This browser cannot save incident updates. Check its storage settings.", "error");
    return false;
  }
}

function dashboardRoute(role) {
  return `#dashboard/${role.toLowerCase()}`;
}

function route() {
  if (!window.Auth?.isReady()) return;
  const loginView = $("#login-view");
  const dashboardView = $("#dashboard-view");
  const session = getSession();
  const currentHash = location.hash || "#login";

  if (!session) {
    if (currentHash !== "#login") location.replace("#login");
    loginView.hidden = false;
    dashboardView.hidden = true;
    return;
  }
  const expectedRoute = dashboardRoute(session.role);
  if (currentHash !== expectedRoute) {
    location.replace(expectedRoute);
    return;
  }
  loginView.hidden = true;
  dashboardView.hidden = false;
  startRealtimeData(session);
  renderDashboard();
  if (persistenceWarning) showMessage("#app-status", persistenceWarning, "error");
}

function syncLoginView(user, error = "", profile = window.Auth?.getProfile?.()) {
  $("#google-signin-section").hidden = Boolean(user);
  $("#google-user-panel").hidden = !user;
  $("#role-selection").hidden = true;
  $("#assigned-role-panel").hidden = !user || !profile?.role;
  $("#assigned-role").textContent = profile?.role ? `${profile.role} dashboard` : "Access profile loading…";
  $("#login-button").disabled = !user || !profile?.role;
  if (user) {
    $("#google-user-name").textContent = user.name;
    $("#google-user-email").textContent = user.email;
    showMessage("#login-status", error || (profile?.role ? "Google sign-in successful. Your assigned workspace is ready." : "Creating your secure access profile…"));
  } else {
    $("#google-user-name").textContent = "";
    $("#google-user-email").textContent = "";
    showMessage("#login-status", error || "Continue with Google to access the emergency dashboards.", error ? "error" : "success");
  }
}

async function beginGoogleSignIn() {
  if (googleSignInInProgress) return;
  googleSignInInProgress = true;
  const button = $("#google-signin-button");
  button.disabled = true;
  try {
    await window.Auth.signInWithGoogle();
  } finally {
    googleSignInInProgress = false;
    button.disabled = false;
  }
}

function handleDashboardLogin() {
  $("#login-role-error").textContent = "";
  if (!window.Auth.getUser()) {
    showMessage("#login-status", "Sign in with Google before choosing a dashboard.", "error");
    return;
  }
  const assignedRole = window.Auth.getProfile?.()?.role;
  const session = window.Auth.chooseRole(assignedRole);
  if (!session) {
    showMessage("#login-status", "Your assigned role is not available. Ask a campus administrator to review your access.", "error");
    return;
  }
  filters = { priority: "All", status: "All", helperStatus: "All", emergencyType: "All" };
  showMessage("#login-status", `Opening the ${session.role} dashboard.`);
  location.hash = dashboardRoute(session.role);
}

function startRealtimeData(session) {
  const key = `${session.uid}:${session.role}`;
  if (subscribedSessionKey === key) return;
  reportSubscription?.();
  userSubscription?.();
  subscribedSessionKey = key;
  $("#connection-state").textContent = navigator.onLine ? "Connecting…" : "Offline";
  reportSubscription = window.Data.subscribeReports((nextReports) => {
    reports = nextReports;
    renderDashboard();
  }, (state) => {
    const indicator = $("#connection-state");
    if (state.error) {
      indicator.textContent = "Sync error";
      indicator.className = "connection-state connection-error";
      showMessage("#app-status", `Shared reports could not synchronize: ${state.error}`, "error");
      return;
    }
    indicator.textContent = state.pendingWrites ? "Saving…" : state.online ? `Live · ${state.source}` : "Offline · changes queued";
    indicator.className = `connection-state ${state.online ? "connection-online" : "connection-offline"}`;
  });
  if (session.role === "Administrator") {
    userSubscription = window.Data.subscribeUsers((users) => {
      managedUsers = users;
      renderAccessManagement();
    }, (error) => showMessage("#app-status", `Role directory could not load: ${error.message}`, "error"));
  }
}

function generateReportId() {
  const date = new Date();
  const datePart = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let reportId;
  do {
    const randomBytes = new Uint8Array(6);
    window.crypto?.getRandomValues?.(randomBytes);
    let randomPart = "";
    for (let index = 0; index < 6; index += 1) {
      const randomValue = randomBytes[index] || Math.floor(Math.random() * 256);
      randomPart += alphabet[randomValue % alphabet.length];
    }
    reportId = `EMG-${datePart}-${randomPart}`;
  } while (reports.some((report) => report.id === reportId));
  return reportId;
}

function formatTimestamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time not recorded";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatDuration(milliseconds) {
  if (!Number.isFinite(milliseconds)) return "No resolved incidents yet";
  const minutes = Math.max(0, Math.round(milliseconds / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours} hr${hours === 1 ? "" : "s"}${remainingMinutes ? ` ${remainingMinutes} min` : ""}`;
}

function setFieldError(errorSelector, fieldSelector, message) {
  const error = $(errorSelector);
  const field = $(fieldSelector);
  if (error) error.textContent = message;
  if (field) field.setAttribute("aria-invalid", message ? "true" : "false");
}

function validateReportForm() {
  const description = $("#description").value.trim();
  const emergencyType = $("#emergency-type").value;
  const building = $("#building").value;
  const floor = $("#floor").value;
  let isValid = true;
  const typeError = EMERGENCY_TYPES.includes(emergencyType) ? "" : "Select an emergency type.";
  setFieldError("#type-error", "#emergency-type", typeError);
  if (typeError) isValid = false;
  const descriptionError = !description
    ? "Describe the emergency."
    : description.length < 5 || description.length > 300
      ? "Description must be between 5 and 300 characters."
      : "";
  setFieldError("#description-error", "#description", descriptionError);
  if (descriptionError) isValid = false;
  const locationError = !building || !floor ? "Select both a building or area and a floor." : "";
  $("#location-error").textContent = locationError;
  $("#building").setAttribute("aria-invalid", !building ? "true" : "false");
  $("#floor").setAttribute("aria-invalid", !floor ? "true" : "false");
  if (locationError) isValid = false;
  const attachment = $("#attachment").files?.[0];
  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "audio/mpeg", "audio/webm", "application/pdf"];
  const attachmentError = attachment && !allowedTypes.includes(attachment.type)
    ? "Use a JPG, PNG, WebP, MP3, WebM, or PDF file."
    : attachment && attachment.size > 10 * 1024 * 1024
      ? "Attachment must be 10 MB or smaller."
      : "";
  $("#attachment-error").textContent = attachmentError;
  $("#attachment").setAttribute("aria-invalid", attachmentError ? "true" : "false");
  if (attachmentError) isValid = false;
  return isValid;
}

function createBadge(text, group) {
  const badge = document.createElement("span");
  badge.className = `badge ${group}-${text.toLowerCase().replaceAll(" ", "-")}`;
  badge.textContent = text;
  return badge;
}

function createDetail(label, value) {
  const row = document.createElement("div");
  const term = document.createElement("dt");
  const description = document.createElement("dd");
  row.className = "detail-row";
  term.textContent = label;
  description.textContent = value;
  row.append(term, description);
  return row;
}

function createTimeline(report, compact = false) {
  const timeline = document.createElement("ol");
  const currentIndex = INCIDENT_STATUSES.indexOf(report.status);
  timeline.className = `incident-timeline${compact ? " compact-timeline" : ""}`;
  timeline.setAttribute("aria-label", `Response timeline for ${report.id}`);
  INCIDENT_STATUSES.forEach((status, index) => {
    const item = document.createElement("li");
    const marker = document.createElement("span");
    const content = document.createElement("div");
    const label = document.createElement("strong");
    const time = document.createElement("span");
    const timestamp = report[STATUS_TIMESTAMP_FIELDS[status]];
    marker.className = "timeline-marker";
    marker.setAttribute("aria-hidden", "true");
    label.textContent = status;
    if (timestamp) {
      item.className = "timeline-complete";
      time.textContent = formatTimestamp(timestamp);
    } else if (status === report.status) {
      item.className = "timeline-current";
      time.textContent = "Current status";
    } else if (index < currentIndex) {
      item.className = "timeline-skipped";
      time.textContent = "Time not recorded";
    } else {
      item.className = "timeline-waiting";
      time.textContent = "Waiting";
    }
    content.append(label, time);
    item.append(marker, content);
    timeline.append(item);
  });
  return timeline;
}

function createIncidentSummary(report) {
  const section = document.createElement("section");
  const title = document.createElement("h4");
  const grid = document.createElement("dl");
  const summaryLabel = document.createElement("strong");
  const summaryText = document.createElement("p");
  section.className = "incident-summary";
  title.textContent = "Incident summary";
  grid.className = "summary-details";
  grid.append(
    createDetail("Type", report.emergencyType),
    createDetail("Location", formatLocation(report.location)),
    createDetail("Priority", report.priority.toUpperCase()),
    createDetail("Reported", formatTimestamp(report.createdAt)),
  );
  summaryLabel.textContent = "Summary";
  summaryText.textContent = report.summary;
  section.append(title, grid, summaryLabel, summaryText);
  return section;
}

async function updateHelperStatus(reportId, helperStatus) {
  if (!isAllowed("updateHelper")) return showMessage("#app-status", "Only volunteers can update helper tasks.", "error");
  if (!HELPER_STATUSES.includes(helperStatus)) return showMessage("#app-status", "That helper task status is not valid.", "error");
  if (!reports.some((report) => report.id === reportId)) return showMessage("#app-status", "That incident is no longer available.", "error");
  try {
    await window.Data.updateHelperStatus(reportId, helperStatus);
    showMessage("#app-status", `Volunteer task for ${reportId} updated to ${helperStatus}.`);
  } catch (error) {
    showMessage("#app-status", error.message || "The volunteer task could not be updated.", "error");
  }
}

async function overridePriority(reportId, priority) {
  if (!isAllowed("overridePriority")) return showMessage("#app-status", "Only administrators can override incident priority.", "error");
  if (!PRIORITIES.includes(priority)) return showMessage("#app-status", "That priority is not valid.", "error");
  const report = reports.find((item) => item.id === reportId);
  if (!report) return showMessage("#app-status", "That incident is no longer available.", "error");
  if (report.priority === priority) return showMessage("#app-status", `${reportId} is already ${priority.toUpperCase()} priority.`);
  try {
    await window.Data.mutateReport(reportId, {
    priority,
    priorityOverridden: true,
    priorityOverrideAt: new Date().toISOString(),
    severity: priorityToSeverity(priority),
  }, "priority.overridden", `Priority changed from ${report.priority} to ${priority}`, { fromPriority: report.priority, toPriority: priority });
    showMessage("#app-status", `${reportId} priority changed to ${priority.toUpperCase()} by an administrator.`);
  } catch (error) {
    showMessage("#app-status", error.message || "Priority could not be updated.", "error");
  }
}

async function updateIncidentStatus(reportId, targetStatus) {
  if (!isAllowed("updateStatus")) return showMessage("#app-status", "Only administrators can update the incident response status.", "error");
  const report = reports.find((item) => item.id === reportId);
  if (!report) return showMessage("#app-status", "That incident is no longer available.", "error");
  if (nextStatus(report.status) !== targetStatus) return showMessage("#app-status", "Incident statuses must move forward one response stage at a time.", "error");
  if (targetStatus === "Resolved" && !window.confirm(`Mark incident ${reportId} as resolved?`)) return;
  const now = new Date().toISOString();
  const timestampField = STATUS_TIMESTAMP_FIELDS[targetStatus];
  try {
    await window.Data.mutateReport(reportId, {
    status: targetStatus,
    [timestampField]: now,
    reportStatus: targetStatus === "Resolved" ? "Resolved" : "Pending",
    ...(targetStatus === "Resolved" ? { resolvedBy: "Administrator" } : {}),
  }, "incident.status", `Incident advanced from ${report.status} to ${targetStatus}`, { fromStatus: report.status, toStatus: targetStatus });
    showMessage("#app-status", `${reportId} moved to ${targetStatus.toUpperCase()}.`);
  } catch (error) {
    showMessage("#app-status", error.message || "Incident status could not be updated.", "error");
  }
}

async function resolveMedicalReport(reportId) {
  if (!isAllowed("resolveMedical")) return showMessage("#app-status", "Only doctors can resolve medical cases.", "error");
  const report = reports.find((item) => item.id === reportId);
  if (!report) return showMessage("#app-status", "That incident is no longer available.", "error");
  if (report.emergencyType !== "Medical") return showMessage("#app-status", "Doctors can resolve medical reports only.", "error");
  if (report.status === "Resolved") return showMessage("#app-status", "This incident has already been resolved.", "error");
  if (!window.confirm(`Mark medical incident ${reportId} as resolved?`)) return;
  const now = new Date().toISOString();
  try {
    await window.Data.mutateReport(reportId, {
    status: "Resolved",
    reportStatus: "Resolved",
    resolvedBy: "Doctor",
    resolvedAt: now,
  }, "medical.resolved", "Medical incident resolved by a doctor", { fromStatus: report.status, toStatus: "Resolved" });
    showMessage("#app-status", `Medical incident ${reportId} resolved.`);
  } catch (error) {
    showMessage("#app-status", error.message || "The medical incident could not be resolved.", "error");
  }
}

function createAdminControls(report) {
  const controls = document.createElement("div");
  const priorityLabel = document.createElement("label");
  const priorityText = document.createElement("span");
  const prioritySelect = document.createElement("select");
  const followingStatus = nextStatus(report.status);
  controls.className = "admin-controls";
  priorityLabel.className = "inline-control";
  priorityText.textContent = "Administrator priority";
  PRIORITIES.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value.toUpperCase();
    option.selected = value === report.priority;
    prioritySelect.append(option);
  });
  prioritySelect.setAttribute("aria-label", `Override priority for ${report.id}`);
  prioritySelect.addEventListener("change", () => overridePriority(report.id, prioritySelect.value));
  priorityLabel.append(priorityText, prioritySelect);
  controls.append(priorityLabel);
  if (followingStatus) {
    const statusButton = document.createElement("button");
    statusButton.className = followingStatus === "Resolved" ? "resolve-button" : "status-button";
    statusButton.type = "button";
    statusButton.textContent = `Mark as ${followingStatus}`;
    statusButton.addEventListener("click", () => updateIncidentStatus(report.id, followingStatus));
    controls.append(statusButton);
  }
  return controls;
}

function createActionButton(label, className, handler) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = label;
  button.addEventListener("click", handler);
  return button;
}

async function showAuditHistory(reportId) {
  const dialog = $("#audit-dialog");
  const content = $("#audit-content");
  $("#audit-heading").textContent = `Incident history · ${reportId}`;
  content.replaceChildren();
  const loading = document.createElement("p");
  loading.textContent = "Loading verified audit events…";
  content.append(loading);
  dialog.showModal();
  try {
    const [events, notes] = await Promise.all([
      window.Data.getAuditHistory(reportId),
      window.Data.getResponderNotes(reportId),
    ]);
    content.replaceChildren();
    if (!events.length) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "No cloud audit entries are available for this incident yet.";
      content.append(empty);
    }
    events.forEach((event) => {
      const item = document.createElement("article");
      const heading = document.createElement("strong");
      const meta = document.createElement("span");
      const message = document.createElement("p");
      item.className = "audit-event";
      heading.textContent = event.action.replaceAll(".", " ");
      meta.textContent = `${event.actorName || "System"} · ${event.actorRole || "System"} · ${formatTimestamp(event.createdAt)}`;
      message.textContent = event.message || "Recorded update";
      item.append(heading, meta, message);
      content.append(item);
    });
    if (notes.length) {
      const notesHeading = document.createElement("h3");
      notesHeading.textContent = "Responder notes";
      content.append(notesHeading);
      notes.forEach((note) => {
        const item = document.createElement("article");
        item.className = "audit-event responder-note";
        const text = document.createElement("p");
        const meta = document.createElement("span");
        text.textContent = note.note;
        meta.textContent = `${note.authorName} · ${note.authorRole} · ${formatTimestamp(note.createdAt)}`;
        item.append(text, meta);
        content.append(item);
      });
    }
  } catch (error) {
    content.textContent = error.message || "Incident history could not be loaded.";
  }
}

async function claimIncident(reportId) {
  try {
    await window.Data.claimReport(reportId);
    showMessage("#app-status", `${reportId} is now assigned to you.`);
  } catch (error) {
    showMessage("#app-status", error.message || "The incident could not be claimed.", "error");
  }
}

async function releaseIncident(reportId) {
  if (!window.confirm(`Release your assignment to ${reportId}?`)) return;
  try {
    await window.Data.releaseReport(reportId);
    showMessage("#app-status", `${reportId} is available for another volunteer.`);
  } catch (error) {
    showMessage("#app-status", error.message || "The assignment could not be released.", "error");
  }
}

async function addIncidentNote(reportId) {
  const note = window.prompt("Add an internal responder note (up to 500 characters):");
  if (note === null) return;
  try {
    await window.Data.addResponderNote(reportId, note);
    showMessage("#app-status", `Responder note added to ${reportId}.`);
  } catch (error) {
    showMessage("#app-status", error.message || "The responder note could not be added.", "error");
  }
}

function createReportCard(report) {
  const role = getSession().role;
  const card = document.createElement("article");
  const topLine = document.createElement("div");
  const headingGroup = document.createElement("div");
  const heading = document.createElement("h3");
  const category = document.createElement("p");
  const badges = document.createElement("div");
  const details = document.createElement("dl");
  const timelineHeading = document.createElement("h4");
  card.className = `report-card priority-card-${report.priority.toLowerCase()}`;
  topLine.className = "card-topline";
  heading.className = "report-id";
  heading.textContent = report.id;
  category.className = "report-category";
  category.textContent = `${report.emergencyType} incident`;
  headingGroup.append(heading, category);
  badges.className = "badges";
  badges.append(createBadge(report.priority.toUpperCase(), "priority"), createBadge(report.status, "status"), createBadge(report.helperStatus, "helper"));
  topLine.append(headingGroup, badges);
  details.className = "report-details";
  details.append(
    createDetail("Location", formatLocation(report.location)),
    createDetail("Description", report.description),
    createDetail("Last updated", formatTimestamp(report.updatedAt)),
    createDetail("Responder guidance", VOLUNTEER_GUIDANCE[report.priority]),
    createDetail("Response target", reportSla(report).text),
  );
  if (report.assignedVolunteerName) details.append(createDetail("Assigned volunteer", report.assignedVolunteerName));
  if (report.escalatedAt) details.append(createDetail("Escalation", `${report.escalationReason || "Response target exceeded"} · ${formatTimestamp(report.escalatedAt)}`));
  if (report.aiRecommendation) {
    const confidence = Number(report.aiRecommendation.confidence);
    details.append(createDetail("AI recommendation", `${report.aiRecommendation.rationale || "Human review required"}${Number.isFinite(confidence) ? ` · ${Math.round(confidence * 100)}% confidence` : ""}`));
  }
  if (Array.isArray(report.attachments) && report.attachments.length) {
    const attachmentRow = document.createElement("div");
    const term = document.createElement("dt");
    const description = document.createElement("dd");
    term.textContent = "Attachments";
    report.attachments.forEach((attachment, index) => {
      const link = document.createElement("a");
      link.href = attachment.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = attachment.name || `Attachment ${index + 1}`;
      description.append(link, document.createTextNode(index < report.attachments.length - 1 ? " · " : ""));
    });
    attachmentRow.className = "detail-row";
    attachmentRow.append(term, description);
    details.append(attachmentRow);
  }
  if (role === "Administrator" && report.priorityOverridden) {
    details.append(createDetail("Priority review", `Original: ${report.originalPriority.toUpperCase()} · Manual override recorded`));
  }
  timelineHeading.className = "timeline-heading";
  timelineHeading.textContent = "Response timeline";
  card.append(topLine, createIncidentSummary(report), details, timelineHeading, createTimeline(report));
  const actions = document.createElement("div");
  actions.className = "card-actions";
  actions.append(createActionButton("View audit history", "secondary-button", () => showAuditHistory(report.id)));
  if (role === "Student") {
    const responseNote = document.createElement("p");
    responseNote.className = "response-note";
    responseNote.textContent = RESPONSE_MESSAGES[report.status];
    card.append(responseNote);
  }
  if (role === "Volunteer") {
    const session = getSession();
    if (!report.assignedVolunteerUid) actions.append(createActionButton("Accept incident", "status-button", () => claimIncident(report.id)));
    else if (report.assignedVolunteerUid === session.uid) actions.append(createActionButton("Release assignment", "secondary-button", () => releaseIncident(report.id)));
    const control = document.createElement("label");
    const label = document.createElement("span");
    const select = document.createElement("select");
    control.className = "inline-control";
    label.textContent = "Helper task status";
    HELPER_STATUSES.forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      option.selected = value === report.helperStatus;
      select.append(option);
    });
    select.setAttribute("aria-label", `Update volunteer task for ${report.id}`);
    select.disabled = report.assignedVolunteerUid !== session.uid;
    if (select.disabled) select.title = report.assignedVolunteerUid ? "Only the assigned volunteer can update this task." : "Accept the incident before updating task progress.";
    select.addEventListener("change", () => updateHelperStatus(report.id, select.value));
    control.append(label, select);
    card.append(control);
  }
  if (role === "Doctor" && report.status !== "Resolved" && report.emergencyType === "Medical") {
    const resolveButton = document.createElement("button");
    resolveButton.className = "resolve-button";
    resolveButton.type = "button";
    resolveButton.textContent = "Mark as Resolved";
    resolveButton.addEventListener("click", () => resolveMedicalReport(report.id));
    card.append(resolveButton);
  }
  if (["Volunteer", "Doctor", "Administrator"].includes(role)) actions.append(createActionButton("Add responder note", "secondary-button", () => addIncidentNote(report.id)));
  card.append(actions);
  if (role === "Administrator") card.append(createAdminControls(report));
  return card;
}

function getVisibleReports(role, email, applyFilters = true) {
  return reports
    .filter((report) => {
      if (role === "Student") return report.submittedBy === email || report.submittedBy === "Student";
      if (role === "Doctor") return report.emergencyType === "Medical";
      return true;
    })
    .filter((report) => !applyFilters || Object.entries(filters).every(([key, value]) => value === "All" || report[key] === value));
}

function createFilter(key, labelText, options) {
  const label = document.createElement("label");
  const labelSpan = document.createElement("span");
  const select = document.createElement("select");
  label.className = "inline-control";
  labelSpan.textContent = labelText;
  options.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    option.selected = value === filters[key];
    select.append(option);
  });
  select.addEventListener("change", () => {
    filters = { ...filters, [key]: select.value };
    renderDashboard();
  });
  label.append(labelSpan, select);
  return label;
}

function appendMetric(container, label, value) {
  const card = document.createElement("article");
  const number = document.createElement("strong");
  const text = document.createElement("span");
  card.className = "analytics-metric";
  number.textContent = String(value);
  text.textContent = label;
  card.append(number, text);
  container.append(card);
}

function renderBarChart(selector, items) {
  const chart = $(selector);
  chart.replaceChildren();
  if (!items.length || items.every((item) => item.count === 0)) {
    const empty = document.createElement("p");
    empty.className = "chart-empty";
    empty.textContent = "No incident data available yet.";
    chart.append(empty);
    return;
  }
  const maximum = Math.max(...items.map((item) => item.count), 1);
  items.slice(0, 7).forEach((item) => {
    const row = document.createElement("div");
    const labels = document.createElement("div");
    const name = document.createElement("span");
    const count = document.createElement("strong");
    const track = document.createElement("div");
    const bar = document.createElement("span");
    row.className = "bar-row";
    labels.className = "bar-labels";
    name.textContent = item.label;
    count.textContent = String(item.count);
    labels.append(name, count);
    track.className = "bar-track";
    bar.className = "bar-fill";
    bar.style.width = `${item.count ? Math.max(6, (item.count / maximum) * 100) : 0}%`;
    track.append(bar);
    row.append(labels, track);
    chart.append(row);
  });
}

function renderAdminAnalytics() {
  const analytics = calculateAnalytics(reports);
  const metrics = $("#analytics-metrics");
  metrics.replaceChildren();
  appendMetric(metrics, "Total incidents", analytics.total);
  appendMetric(metrics, "Active incidents", analytics.active);
  appendMetric(metrics, "Critical incidents", analytics.critical);
  appendMetric(metrics, "Resolved incidents", analytics.resolved);
  appendMetric(metrics, "Average resolution", formatDuration(analytics.averageResolutionMs));
  renderBarChart("#category-chart", analytics.categories);
  renderBarChart("#location-chart", analytics.locations);
  renderBarChart("#trend-chart", analytics.daily);
  const hotspot = $("#hotspot-result");
  hotspot.replaceChildren();
  if (analytics.hotspot) {
    const warning = document.createElement("p");
    const hotspotLocation = document.createElement("strong");
    const count = document.createElement("span");
    warning.className = "hotspot-warning";
    warning.textContent = "Recurring incident area";
    hotspotLocation.textContent = analytics.hotspot.label;
    count.textContent = `${analytics.hotspot.count} incidents recorded in the last 30 days.`;
    hotspot.append(warning, hotspotLocation, count);
  } else {
    const empty = document.createElement("p");
    empty.className = "chart-empty";
    empty.textContent = "No location has two or more incidents in the last 30 days.";
    hotspot.append(empty);
  }
  renderSlaHealth();
  renderCampusMap();
}

function responseTargetMinutes(priority) {
  return { Critical: 5, High: 10, Medium: 20, Low: 45 }[priority] || 45;
}

function reportSla(report) {
  if (report.status === "Resolved") return { state: "complete", text: "Resolved" };
  const ageMinutes = Math.max(0, (Date.now() - new Date(report.createdAt).getTime()) / 60000);
  const target = responseTargetMinutes(report.priority);
  const remaining = Math.ceil(target - ageMinutes);
  return remaining >= 0
    ? { state: remaining <= Math.max(2, target * 0.25) ? "warning" : "healthy", text: `${remaining} min remaining` }
    : { state: "breached", text: `${Math.abs(remaining)} min overdue` };
}

function renderSlaHealth() {
  const container = $("#sla-result");
  container.replaceChildren();
  const active = reports.filter((report) => report.status !== "Resolved");
  const counts = { healthy: 0, warning: 0, breached: 0 };
  active.forEach((report) => { counts[reportSla(report).state] += 1; });
  [["Within target", counts.healthy], ["Approaching target", counts.warning], ["Escalation required", counts.breached]].forEach(([label, value]) => {
    const row = document.createElement("div");
    row.className = "sla-row";
    const text = document.createElement("span");
    const number = document.createElement("strong");
    text.textContent = label;
    number.textContent = String(value);
    row.append(text, number);
    container.append(row);
  });
}

const CAMPUS_POINTS = {
  "Main Gate": [12, 78], "Administration Building": [31, 24], Library: [48, 42],
  "Science Block": [68, 27], "Engineering Block": [76, 55], "Tech Park": [58, 72],
  "Student Hostel": [25, 65], Cafeteria: [43, 62], "Sports Ground": [83, 82], "Parking Area": [14, 42], Other: [50, 50],
};

function renderCampusMap() {
  const map = $("#campus-map");
  map.replaceChildren();
  const label = document.createElement("span");
  label.className = "map-campus-label";
  label.textContent = "SRM Campus · approximate operational view";
  map.append(label);
  reports.forEach((report) => {
    const [x, y] = CAMPUS_POINTS[report.location?.building] || CAMPUS_POINTS.Other;
    const marker = document.createElement("button");
    marker.type = "button";
    marker.className = `map-marker map-${report.priority.toLowerCase()}`;
    marker.style.left = `${x}%`;
    marker.style.top = `${y}%`;
    marker.textContent = report.priority === "Critical" ? "!" : String(Math.max(1, reports.filter((item) => item.location?.building === report.location?.building).length));
    marker.title = `${report.id}: ${report.emergencyType} at ${report.location?.building}`;
    marker.setAttribute("aria-label", marker.title);
    marker.addEventListener("click", () => {
      trackedReportId = report.id;
      showMessage("#app-status", `${report.id}: ${report.summary}`);
    });
    map.append(marker);
  });
}

function renderAccessManagement() {
  const container = $("#user-access-list");
  if (!container || getSession()?.role !== "Administrator") return;
  container.replaceChildren();
  if (!managedUsers.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No user profiles are available yet.";
    container.append(empty);
    return;
  }
  managedUsers.forEach((user) => {
    const row = document.createElement("article");
    const identity = document.createElement("div");
    const name = document.createElement("strong");
    const email = document.createElement("span");
    const label = document.createElement("label");
    const select = document.createElement("select");
    row.className = "user-access-row";
    name.textContent = user.displayName || "Campus user";
    email.textContent = user.email || user.uid;
    identity.append(name, email);
    label.textContent = "Assigned role";
    ["Student", "Volunteer", "Doctor", "Administrator"].forEach((role) => {
      const option = document.createElement("option");
      option.value = role;
      option.textContent = role;
      option.selected = role === user.role;
      select.append(option);
    });
    select.disabled = user.uid === getSession().uid;
    select.addEventListener("change", async () => {
      const requestedRole = select.value;
      if (!window.confirm(`Assign ${requestedRole} access to ${user.displayName || user.email}?`)) {
        select.value = user.role;
        return;
      }
      select.disabled = true;
      try {
        await window.Data.setUserRole(user.uid, requestedRole);
        showMessage("#app-status", `${user.displayName || user.email} now has ${requestedRole} access.`);
      } catch (error) {
        select.value = user.role;
        showMessage("#app-status", error.message || "The role could not be assigned.", "error");
      } finally {
        select.disabled = false;
      }
    });
    label.append(select);
    row.append(identity, label);
    container.append(row);
  });
}

function renderTrackingResult() {
  const result = $("#tracking-result");
  const error = $("#tracking-error");
  result.replaceChildren();
  error.textContent = "";
  if (!trackedReportId) return;
  const session = getSession();
  const report = getVisibleReports("Student", session.email, false).find((item) => item.id.toUpperCase() === trackedReportId.toUpperCase());
  if (!report) {
    error.textContent = "No report with that ID is available in your submitted reports.";
    return;
  }
  const card = document.createElement("article");
  const title = document.createElement("h3");
  const type = document.createElement("p");
  const badges = document.createElement("div");
  const details = document.createElement("dl");
  const note = document.createElement("p");
  card.className = "tracking-result-card";
  title.textContent = `Report ${report.id}`;
  type.textContent = `${report.emergencyType} · ${formatLocation(report.location)}`;
  badges.className = "badges tracking-badges";
  badges.append(createBadge(report.priority.toUpperCase(), "priority"), createBadge(report.status, "status"));
  details.className = "report-details tracking-details";
  details.append(createDetail("Current status", report.status), createDetail("Last updated", formatTimestamp(report.updatedAt)));
  note.className = "response-note";
  note.textContent = RESPONSE_MESSAGES[report.status];
  card.append(title, type, badges, details, createTimeline(report, true), note);
  result.append(card);
}

function renderDashboard() {
  const session = getSession();
  if (!session) return;
  const { role } = session;
  const titles = {
    Student: "My emergency reports",
    Volunteer: "Incoming emergency incidents",
    Doctor: "Medical emergency cases",
    Administrator: "Incident command dashboard",
  };
  $("#dashboard-eyebrow").textContent = `${role} dashboard`;
  $("#dashboard-heading").textContent = titles[role];
  $("#current-user").textContent = `${role} · ${session.email}`;
  $("#student-form-section").hidden = role !== "Student";
  $("#student-tracking-section").hidden = role !== "Student";
  $("#admin-analytics").hidden = role !== "Administrator";
  $("#access-management").hidden = role !== "Administrator";
  $("#workflow-note").textContent = {
    Volunteer: "Update your assistance task as work progresses. Volunteers cannot change overall incident status or priority.",
    Doctor: "Doctors can review medical incidents and resolve medical cases. Administrator response progress remains visible.",
    Administrator: "Review automatic priority, advance incidents through the response timeline, and use analytics to identify recurring risks.",
    Student: "Your report receives an automatic safety priority. Track acknowledgement, response, and resolution here.",
  }[role];
  const visibleReports = getVisibleReports(role, session.email);
  $("#report-count").textContent = `${visibleReports.length} ${visibleReports.length === 1 ? "incident" : "incidents"}`;
  const summary = $("#summary-cards");
  summary.replaceChildren();
  const summaryItems = [
    ["Visible incidents", visibleReports.length],
    ["Active", visibleReports.filter((report) => report.status !== "Resolved").length],
    ["Critical", visibleReports.filter((report) => report.priority === "Critical").length],
    ["Resolved", visibleReports.filter((report) => report.status === "Resolved").length],
    ["Responders on it", visibleReports.filter((report) => report.helperStatus === "On it").length],
  ];
  summaryItems.forEach(([label, number]) => {
    const card = document.createElement("div");
    const count = document.createElement("strong");
    const text = document.createElement("span");
    card.className = "summary-card";
    count.textContent = String(number);
    text.textContent = label;
    card.append(count, text);
    summary.append(card);
  });
  if (role === "Administrator") renderAdminAnalytics();
  if (role === "Administrator") renderAccessManagement();
  if (role === "Student") renderTrackingResult();
  const filterArea = $("#filters");
  filterArea.replaceChildren();
  if (role !== "Student") {
    filterArea.append(createFilter("priority", "Priority", ["All", ...PRIORITIES]), createFilter("status", "Response status", ["All", ...INCIDENT_STATUSES]));
    if (role === "Volunteer" || role === "Administrator") filterArea.append(createFilter("helperStatus", "Helper task", ["All", ...HELPER_STATUSES]));
    if (role === "Administrator") filterArea.append(createFilter("emergencyType", "Category", ["All", ...EMERGENCY_TYPES]));
  }
  const reportList = $("#reports-list");
  reportList.replaceChildren();
  if (!visibleReports.length) {
    const emptyState = document.createElement("p");
    emptyState.className = "empty-state";
    emptyState.textContent = reports.length ? "No incidents match this dashboard or the selected filters." : "No emergency incidents have been submitted yet.";
    reportList.append(emptyState);
    return;
  }
  visibleReports
    .slice()
    .sort((first, second) => PRIORITIES.indexOf(first.priority) - PRIORITIES.indexOf(second.priority) || new Date(second.createdAt) - new Date(first.createdAt))
    .forEach((report) => reportList.append(createReportCard(report)));
}

async function submitEmergencyReport(event) {
  event.preventDefault();
  if (reportSubmissionInProgress || !isAllowed("submit") || !validateReportForm()) return;
  reportSubmissionInProgress = true;
  const submitButton = $("#emergency-form button[type='submit']");
  submitButton.disabled = true;
  submitButton.textContent = "Saving incident…";
  const session = getSession();
  const createdAt = new Date().toISOString();
  const incidentLocation = {
    campus: $("#campus").value,
    building: $("#building").value,
    floor: $("#floor").value,
    area: $("#area").value.trim(),
    coordinates: capturedCoordinates,
  };
  const emergencyType = $("#emergency-type").value;
  const description = $("#description").value.trim();
  const rulePriority = classifyPriority({ emergencyType, description, location: incidentLocation });
  let aiRecommendation = null;
  try {
    submitButton.textContent = "Analyzing safely…";
    aiRecommendation = await window.Data.requestAiRecommendation({ emergencyType, description, location: incidentLocation });
  } catch {
    // Deterministic safety rules remain available if the server-side AI is not configured.
  }
  const priority = ["Critical", "High", "Medium", "Low"].includes(aiRecommendation?.priority)
    ? (PRIORITIES.indexOf(aiRecommendation.priority) < PRIORITIES.indexOf(rulePriority) ? aiRecommendation.priority : rulePriority)
    : rulePriority;
  const id = generateReportId();
  const report = migrateReport({
    id,
    emergencyType,
    description,
    summary: aiRecommendation?.summary || summarizeDescription(description),
    aiRecommendation: aiRecommendation ? {
      ...aiRecommendation,
      reviewed: false,
      generatedAt: new Date().toISOString(),
      model: aiRecommendation.model || "Vercel AI Gateway",
    } : {
      priority: rulePriority,
      summary: summarizeDescription(description),
      confidence: 1,
      rationale: "Deterministic safety rules were used because server AI was unavailable.",
      guidance: VOLUNTEER_GUIDANCE[rulePriority],
      source: "deterministic-fallback",
      reviewed: false,
      generatedAt: new Date().toISOString(),
    },
    priority,
    originalPriority: priority,
    priorityOverridden: false,
    location: incidentLocation,
    status: "Reported",
    createdAt,
    reportedAt: createdAt,
    updatedAt: createdAt,
    helperStatus: "Not yet",
    submittedBy: session.email,
  });
  try {
    if (!report) throw new Error("The report could not be prepared safely.");
    submitButton.textContent = "Saving incident…";
    const attachment = $("#attachment").files?.[0] || null;
    await window.Data.createReport(report, attachment);
    $("#emergency-form").reset();
    $("#campus").value = "SRM Campus";
    $("#character-count").textContent = "0 / 300";
    trackedReportId = report.id;
    $("#tracking-id").value = report.id;
    capturedCoordinates = null;
    $("#location-coordinate-status").textContent = "GPS is optional and is shared only with authorized responders.";
    showMessage("#app-status", `Emergency report submitted and synchronized. Report ID: ${report.id}. Priority: ${report.priority.toUpperCase()}.`);
  } catch (error) {
    showMessage("#app-status", error.message || "The report could not be saved.", "error");
  }
  reportSubmissionInProgress = false;
  submitButton.disabled = false;
  submitButton.textContent = "Report Emergency";
}

function captureLocation() {
  const button = $("#location-button");
  const status = $("#location-coordinate-status");
  if (!navigator.geolocation) {
    status.textContent = "Location services are not supported by this browser.";
    return;
  }
  button.disabled = true;
  status.textContent = "Requesting your location…";
  navigator.geolocation.getCurrentPosition((position) => {
    capturedCoordinates = {
      latitude: Number(position.coords.latitude.toFixed(6)),
      longitude: Number(position.coords.longitude.toFixed(6)),
      accuracyMeters: Math.round(position.coords.accuracy),
    };
    status.textContent = `Location captured (accuracy approximately ${capturedCoordinates.accuracyMeters} m).`;
    button.disabled = false;
  }, () => {
    status.textContent = "Location was not shared. You can still submit using the campus fields.";
    button.disabled = false;
  }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
}

function trackReport(event) {
  event.preventDefault();
  trackedReportId = $("#tracking-id").value.trim();
  if (!trackedReportId) {
    $("#tracking-error").textContent = "Enter a Report ID.";
    $("#tracking-result").replaceChildren();
    return;
  }
  renderTrackingResult();
}

async function signOutUser() {
  try {
    reportSubscription?.();
    userSubscription?.();
    subscribedSessionKey = "";
    await window.Auth.logout();
    document.querySelectorAll("input[name='login-role']").forEach((input) => { input.checked = false; });
    trackedReportId = "";
    location.replace("#login");
  } catch {
    showMessage("#app-status", "Sign-out failed. Check your connection and try again.", "error");
  }
}

async function enableNotifications() {
  const button = $("#notification-button");
  button.disabled = true;
  try {
    const result = await window.Data.requestNotifications();
    button.textContent = result.browserOnly ? "Browser alerts enabled" : "Push alerts enabled";
    showMessage("#app-status", result.browserOnly
      ? "Browser alerts are enabled. Add the Firebase VAPID key to enable alerts when the app is closed."
      : "Push notifications are enabled for this device.");
  } catch (error) {
    showMessage("#app-status", error.message || "Notifications could not be enabled.", "error");
    button.disabled = false;
  }
}

async function startApp() {
  if (appStarted) return;
  appStarted = true;
  $("#login-form").addEventListener("submit", (event) => { event.preventDefault(); handleDashboardLogin(); });
  $("#google-signin-button").addEventListener("click", beginGoogleSignIn);
  $("#change-google-account").addEventListener("click", signOutUser);
  $("#logout-button").addEventListener("click", signOutUser);
  $("#description").addEventListener("input", () => { $("#character-count").textContent = `${$("#description").value.length} / 300`; });
  $("#emergency-form").addEventListener("submit", submitEmergencyReport);
  $("#tracking-form").addEventListener("submit", trackReport);
  $("#location-button").addEventListener("click", captureLocation);
  $("#notification-button").addEventListener("click", enableNotifications);
  $("#audit-close").addEventListener("click", () => $("#audit-dialog").close());
  window.addEventListener("online", () => { if (getSession()) startRealtimeData(getSession()); });
  window.addEventListener("offline", () => { $("#connection-state").textContent = "Offline · changes queued"; });
  window.addEventListener("hashchange", route);
  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY) {
      reports = loadReports();
      if (getSession()) renderDashboard();
    }
  });
  window.addEventListener("data-local-change", (event) => {
    reports = Array.isArray(event.detail) ? event.detail : loadReports();
    if (getSession()) renderDashboard();
  });
  window.addEventListener("google-auth-progress", (event) => { showMessage("#login-status", event.detail || "Signing in with Google…"); });
  window.addEventListener("google-auth-state", (event) => {
    syncLoginView(event.detail?.user || null, event.detail?.error || "", event.detail?.profile || null);
    route();
  });
  await window.Auth.whenReady();
  syncLoginView(window.Auth.getUser(), "", window.Auth.getProfile?.());
  route();
}

if (window.Auth) startApp();
else window.addEventListener("auth-module-ready", startApp, { once: true });

