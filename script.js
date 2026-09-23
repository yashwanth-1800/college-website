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
  renderDashboard();
  if (persistenceWarning) showMessage("#app-status", persistenceWarning, "error");
}

function syncLoginView(user, error = "") {
  $("#google-signin-section").hidden = Boolean(user);
  $("#google-user-panel").hidden = !user;
  $("#role-selection").disabled = !user;
  $("#login-button").disabled = !user;
  if (user) {
    $("#google-user-name").textContent = user.name;
    $("#google-user-email").textContent = user.email;
    showMessage("#login-status", error || "Google sign-in successful. Choose your dashboard.");
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
  const selectedRole = $("input[name='login-role']:checked")?.value;
  if (!selectedRole) {
    $("#login-role-error").textContent = "Select a dashboard role.";
    return;
  }
  const session = window.Auth.chooseRole(selectedRole);
  if (!session) {
    showMessage("#login-status", "Your dashboard session could not be saved. Check browser storage settings.", "error");
    return;
  }
  filters = { priority: "All", status: "All", helperStatus: "All", emergencyType: "All" };
  showMessage("#login-status", `Opening the ${session.role} dashboard.`);
  location.hash = dashboardRoute(session.role);
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

function updateHelperStatus(reportId, helperStatus) {
  if (!isAllowed("updateHelper")) return showMessage("#app-status", "Only volunteers can update helper tasks.", "error");
  if (!HELPER_STATUSES.includes(helperStatus)) return showMessage("#app-status", "That helper task status is not valid.", "error");
  if (!reports.some((report) => report.id === reportId)) return showMessage("#app-status", "That incident is no longer available.", "error");
  const now = new Date().toISOString();
  const nextReports = reports.map((report) => report.id === reportId ? { ...report, helperStatus, helperUpdatedAt: now, updatedAt: now } : report);
  if (saveReports(nextReports)) {
    showMessage("#app-status", `Volunteer task for ${reportId} updated to ${helperStatus}.`);
    renderDashboard();
  }
}

function overridePriority(reportId, priority) {
  if (!isAllowed("overridePriority")) return showMessage("#app-status", "Only administrators can override incident priority.", "error");
  if (!PRIORITIES.includes(priority)) return showMessage("#app-status", "That priority is not valid.", "error");
  const report = reports.find((item) => item.id === reportId);
  if (!report) return showMessage("#app-status", "That incident is no longer available.", "error");
  if (report.priority === priority) return showMessage("#app-status", `${reportId} is already ${priority.toUpperCase()} priority.`);
  const now = new Date().toISOString();
  const nextReports = reports.map((item) => item.id === reportId ? {
    ...item,
    priority,
    priorityOverridden: true,
    priorityOverrideAt: now,
    updatedAt: now,
    severity: priorityToSeverity(priority),
  } : item);
  if (saveReports(nextReports)) {
    showMessage("#app-status", `${reportId} priority changed to ${priority.toUpperCase()} by an administrator.`);
    renderDashboard();
  }
}

function updateIncidentStatus(reportId, targetStatus) {
  if (!isAllowed("updateStatus")) return showMessage("#app-status", "Only administrators can update the incident response status.", "error");
  const report = reports.find((item) => item.id === reportId);
  if (!report) return showMessage("#app-status", "That incident is no longer available.", "error");
  if (nextStatus(report.status) !== targetStatus) return showMessage("#app-status", "Incident statuses must move forward one response stage at a time.", "error");
  if (targetStatus === "Resolved" && !window.confirm(`Mark incident ${reportId} as resolved?`)) return;
  const now = new Date().toISOString();
  const timestampField = STATUS_TIMESTAMP_FIELDS[targetStatus];
  const nextReports = reports.map((item) => item.id === reportId ? {
    ...item,
    status: targetStatus,
    [timestampField]: now,
    updatedAt: now,
    reportStatus: targetStatus === "Resolved" ? "Resolved" : "Pending",
    resolvedBy: targetStatus === "Resolved" ? "Administrator" : item.resolvedBy,
  } : item);
  if (saveReports(nextReports)) {
    showMessage("#app-status", `${reportId} moved to ${targetStatus.toUpperCase()}.`);
    renderDashboard();
  }
}

function resolveMedicalReport(reportId) {
  if (!isAllowed("resolveMedical")) return showMessage("#app-status", "Only doctors can resolve medical cases.", "error");
  const report = reports.find((item) => item.id === reportId);
  if (!report) return showMessage("#app-status", "That incident is no longer available.", "error");
  if (report.emergencyType !== "Medical") return showMessage("#app-status", "Doctors can resolve medical reports only.", "error");
  if (report.status === "Resolved") return showMessage("#app-status", "This incident has already been resolved.", "error");
  if (!window.confirm(`Mark medical incident ${reportId} as resolved?`)) return;
  const now = new Date().toISOString();
  const nextReports = reports.map((item) => item.id === reportId ? {
    ...item,
    status: "Resolved",
    reportStatus: "Resolved",
    resolvedBy: "Doctor",
    resolvedAt: now,
    updatedAt: now,
  } : item);
  if (saveReports(nextReports)) {
    showMessage("#app-status", `Medical incident ${reportId} resolved.`);
    renderDashboard();
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
  );
  if (role === "Administrator" && report.priorityOverridden) {
    details.append(createDetail("Priority review", `Original: ${report.originalPriority.toUpperCase()} · Manual override recorded`));
  }
  timelineHeading.className = "timeline-heading";
  timelineHeading.textContent = "Response timeline";
  card.append(topLine, createIncidentSummary(report), details, timelineHeading, createTimeline(report));
  if (role === "Student") {
    const responseNote = document.createElement("p");
    responseNote.className = "response-note";
    responseNote.textContent = RESPONSE_MESSAGES[report.status];
    card.append(responseNote);
  }
  if (role === "Volunteer") {
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

function submitEmergencyReport(event) {
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
  };
  const emergencyType = $("#emergency-type").value;
  const description = $("#description").value.trim();
  const priority = classifyPriority({ emergencyType, description, location: incidentLocation });
  const id = generateReportId();
  const report = migrateReport({
    id,
    emergencyType,
    description,
    summary: summarizeDescription(description),
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
  if (report && saveReports([...reports, report])) {
    $("#emergency-form").reset();
    $("#campus").value = "SRM Campus";
    $("#character-count").textContent = "0 / 300";
    trackedReportId = report.id;
    $("#tracking-id").value = report.id;
    showMessage("#app-status", `Emergency report submitted. Report ID: ${report.id}. Priority: ${report.priority.toUpperCase()}.`);
    renderDashboard();
  }
  reportSubmissionInProgress = false;
  submitButton.disabled = false;
  submitButton.textContent = "Report Emergency";
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
    await window.Auth.logout();
    document.querySelectorAll("input[name='login-role']").forEach((input) => { input.checked = false; });
    trackedReportId = "";
    location.replace("#login");
  } catch {
    showMessage("#app-status", "Sign-out failed. Check your connection and try again.", "error");
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
  window.addEventListener("hashchange", route);
  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY) {
      reports = loadReports();
      if (getSession()) renderDashboard();
    }
  });
  window.addEventListener("google-auth-progress", (event) => { showMessage("#login-status", event.detail || "Signing in with Google…"); });
  window.addEventListener("google-auth-state", (event) => {
    syncLoginView(event.detail?.user || null, event.detail?.error || "");
    route();
  });
  await window.Auth.whenReady();
  syncLoginView(window.Auth.getUser());
  route();
}

if (window.Auth) startApp();
else window.addEventListener("auth-module-ready", startApp, { once: true });
