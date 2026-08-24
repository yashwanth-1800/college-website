"use strict";

const STORAGE_KEY = "campusEmergencyReports";
const EMERGENCY_TYPES = ["Medical", "Fire", "Security", "Accident", "Other"];
const CAMPUS_LOCATIONS = [
  "Main Gate",
  "Administration Building",
  "Library",
  "Science Block",
  "Engineering Block",
  "Student Hostel",
  "Cafeteria",
  "Sports Ground",
  "Parking Area",
  "Other",
];
const VOLUNTEER_GUIDANCE = {
  Low: "Check and assist the student on-site.",
  Medium: "Escort the student to the medical block.",
  High: "Coordinate directly with doctors or bring medical help immediately.",
};

const $ = (selector) => document.querySelector(selector);

let reports = loadReports();
let filters = { severity: "All", reportStatus: "All", helperStatus: "All" };
let reportSubmissionInProgress = false;
let googleSignInInProgress = false;
let appStarted = false;

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
    resolve: role === "Doctor",
  }[action] === true;
}

function normalizeReport(value) {
  if (!value || typeof value !== "object") return null;

  const report = {
    id: value.id,
    emergencyType: value.emergencyType || value.type,
    description: value.description,
    location: value.location,
    severity: value.severity || "Low",
    timestamp: value.timestamp,
    reportStatus: value.reportStatus || value.status || "Pending",
    helperStatus: value.helperStatus || "Not yet",
    submittedBy: value.submittedBy || "Student",
    resolvedBy: value.resolvedBy,
    resolvedAt: value.resolvedAt,
  };

  const valid =
    typeof report.id === "string" &&
    EMERGENCY_TYPES.includes(report.emergencyType) &&
    typeof report.description === "string" &&
    CAMPUS_LOCATIONS.includes(report.location) &&
    ["Low", "Medium", "High"].includes(report.severity) &&
    ["Pending", "Resolved"].includes(report.reportStatus) &&
    ["Not yet", "On it", "Done"].includes(report.helperStatus);

  return valid ? report : null;
}

function loadReports() {
  try {
    const storedValue = localStorage.getItem(STORAGE_KEY);
    if (!storedValue) return [];
    const parsedValue = JSON.parse(storedValue);
    if (!Array.isArray(parsedValue)) return [];
    return parsedValue.map(normalizeReport).filter(Boolean);
  } catch {
    return [];
  }
}

function saveReports(nextReports) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextReports));
    reports = nextReports;
    return true;
  } catch {
    showMessage("#app-status", "This browser cannot save report updates. Check its storage settings.", "error");
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
}

function syncLoginView(user, error = "") {
  const signInSection = $("#google-signin-section");
  const userPanel = $("#google-user-panel");
  const roleSelection = $("#role-selection");
  const continueButton = $("#login-button");

  signInSection.hidden = Boolean(user);
  userPanel.hidden = !user;
  roleSelection.disabled = !user;
  continueButton.disabled = !user;

  if (user) {
    $("#google-user-name").textContent = user.name;
    $("#google-user-email").textContent = user.email;
    showMessage("#login-status", error || "Google sign-in successful. Choose your dashboard.");
  } else {
    $("#google-user-name").textContent = "";
    $("#google-user-email").textContent = "";
    showMessage(
      "#login-status",
      error || "Continue with Google to access the emergency dashboards.",
      error ? "error" : "success",
    );
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
  const roleError = $("#login-role-error");
  roleError.textContent = "";

  if (!window.Auth.getUser()) {
    showMessage("#login-status", "Sign in with Google before choosing a dashboard.", "error");
    return;
  }

  const selectedRole = $("input[name='login-role']:checked")?.value;
  if (!selectedRole) {
    roleError.textContent = "Select a dashboard role.";
    return;
  }

  const session = window.Auth.chooseRole(selectedRole);
  if (!session) {
    showMessage("#login-status", "Your dashboard session could not be saved. Check browser storage settings.", "error");
    return;
  }

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
    reportId = `ER-${datePart}-${randomPart}`;
  } while (reports.some((report) => report.id === reportId));

  return reportId;
}

function formatTimestamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Timestamp unavailable";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function setFieldError(errorSelector, fieldSelector, message) {
  $(errorSelector).textContent = message;
  const field = $(fieldSelector);
  if (field) field.setAttribute("aria-invalid", message ? "true" : "false");
}

function validateReportForm() {
  const description = $("#description").value.trim();
  const severity = $("input[name='severity']:checked")?.value;
  let isValid = true;

  const checks = [
    ["#type-error", "#emergency-type", EMERGENCY_TYPES.includes($("#emergency-type").value), "Select an emergency type."],
    ["#description-error", "#description", description.length >= 5 && description.length <= 300, "Description must be between 5 and 300 characters."],
    ["#location-error", "#location", CAMPUS_LOCATIONS.includes($("#location").value), "Select a campus location."],
  ];

  checks.forEach(([errorSelector, fieldSelector, passes, message]) => {
    setFieldError(errorSelector, fieldSelector, passes ? "" : message);
    if (!passes) isValid = false;
  });

  $("#severity-error").textContent = severity ? "" : "Select one severity level.";
  if (!severity) isValid = false;
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

function updateHelperStatus(reportId, helperStatus) {
  if (!isAllowed("updateHelper")) {
    showMessage("#app-status", "Only volunteers can update helper tasks.", "error");
    return;
  }
  if (!["Not yet", "On it", "Done"].includes(helperStatus)) {
    showMessage("#app-status", "That helper task status is not valid.", "error");
    return;
  }
  if (!reports.some((report) => report.id === reportId)) {
    showMessage("#app-status", "That report is no longer available.", "error");
    return;
  }

  const nextReports = reports.map((report) =>
    report.id === reportId ? { ...report, helperStatus } : report,
  );
  if (saveReports(nextReports)) {
    showMessage("#app-status", `Volunteer task updated to ${helperStatus}.`);
    renderDashboard();
  }
}

function resolveMedicalReport(reportId) {
  if (!isAllowed("resolve")) {
    showMessage("#app-status", "Only doctors can resolve medical cases.", "error");
    return;
  }

  const report = reports.find((item) => item.id === reportId);
  if (!report) {
    showMessage("#app-status", "That report is no longer available.", "error");
    return;
  }
  if (report.emergencyType !== "Medical") {
    showMessage("#app-status", "Doctors can resolve medical reports only.", "error");
    return;
  }
  if (report.reportStatus !== "Pending") {
    showMessage("#app-status", "This report has already been resolved.", "error");
    return;
  }

  if (!window.confirm(`Mark medical report ${reportId} as resolved?`)) return;

  const nextReports = reports.map((item) =>
    item.id === reportId
      ? { ...item, reportStatus: "Resolved", resolvedBy: "Doctor", resolvedAt: new Date().toISOString() }
      : item,
  );
  if (saveReports(nextReports)) {
    showMessage("#app-status", `Medical report ${reportId} resolved.`);
    renderDashboard();
  }
}

function createReportCard(report) {
  const role = getSession().role;
  const card = document.createElement("article");
  const topLine = document.createElement("div");
  const heading = document.createElement("h3");
  const badges = document.createElement("div");
  const details = document.createElement("dl");

  card.className = `report-card ${report.severity === "High" ? "high-priority" : ""}`;
  topLine.className = "card-topline";
  heading.className = "report-id";
  heading.textContent = report.id;
  badges.className = "badges";
  badges.append(
    createBadge(`${report.severity} severity`, "severity"),
    createBadge(report.reportStatus, "report"),
    createBadge(report.helperStatus, "helper"),
  );
  topLine.append(heading, badges);

  details.className = "report-details";
  details.append(
    createDetail("Emergency type", report.emergencyType),
    createDetail("Location", report.location),
    createDetail("Description", report.description),
    createDetail("Submitted", formatTimestamp(report.timestamp)),
    createDetail("Volunteer guidance", VOLUNTEER_GUIDANCE[report.severity]),
  );
  if (report.resolvedAt) {
    details.append(createDetail("Resolved", `${report.resolvedBy} · ${formatTimestamp(report.resolvedAt)}`));
  }
  card.append(topLine, details);

  if (role === "Volunteer") {
    const control = document.createElement("label");
    const label = document.createElement("span");
    const select = document.createElement("select");
    control.className = "inline-control";
    label.textContent = "Helper task status";
    ["Not yet", "On it", "Done"].forEach((value) => {
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

  if (role === "Doctor" && report.reportStatus === "Pending" && report.emergencyType === "Medical") {
    const resolveButton = document.createElement("button");
    resolveButton.className = "resolve-button";
    resolveButton.type = "button";
    resolveButton.textContent = "Mark as Resolved";
    resolveButton.addEventListener("click", () => resolveMedicalReport(report.id));
    card.append(resolveButton);
  }

  return card;
}

function getVisibleReports(role, email) {
  return reports
    .filter((report) => {
      if (role === "Student") return report.submittedBy === email || report.submittedBy === "Student";
      if (role === "Doctor") return report.emergencyType === "Medical";
      return true;
    })
    .filter((report) =>
      Object.entries(filters).every(([key, value]) => value === "All" || report[key] === value),
    );
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

function renderDashboard() {
  const session = getSession();
  if (!session) return;

  const { role } = session;
  const titles = {
    Student: "My submitted reports",
    Volunteer: "Incoming emergency reports",
    Doctor: "Medical emergency cases",
  };

  $("#dashboard-eyebrow").textContent = `${role} dashboard`;
  $("#dashboard-heading").textContent = titles[role];
  $("#current-user").textContent = `${role} · ${session.email}`;
  $("#student-form-section").hidden = role !== "Student";
  $("#workflow-note").textContent =
    role === "Volunteer"
      ? "Not yet = no volunteer has started; On it = assistance or transport is in progress; Done = assistance is complete. Volunteers cannot resolve reports."
      : role === "Doctor"
        ? "Doctors can resolve pending medical cases only."
        : "Reports start Pending; volunteers assist, and doctors close medical cases.";

  const visibleReports = getVisibleReports(role, session.email);
  $("#report-count").textContent = `${visibleReports.length} ${visibleReports.length === 1 ? "report" : "reports"}`;

  const summary = $("#summary-cards");
  summary.replaceChildren();
  const summaryItems = [
    ["Visible reports", visibleReports.length],
    ["Pending", visibleReports.filter((report) => report.reportStatus === "Pending").length],
    ["High severity", visibleReports.filter((report) => report.severity === "High").length],
    ["Resolved", visibleReports.filter((report) => report.reportStatus === "Resolved").length],
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

  const filterArea = $("#filters");
  filterArea.replaceChildren();
  if (role !== "Student") {
    filterArea.append(
      createFilter("severity", "Severity", ["All", "Low", "Medium", "High"]),
      createFilter("reportStatus", "Report status", ["All", "Pending", "Resolved"]),
    );
    if (role === "Volunteer") {
      filterArea.append(createFilter("helperStatus", "Helper task", ["All", "Not yet", "On it", "Done"]));
    }
  }

  const reportList = $("#reports-list");
  reportList.replaceChildren();
  if (!visibleReports.length) {
    const emptyState = document.createElement("p");
    emptyState.className = "empty-state";
    emptyState.textContent = reports.length
      ? "No emergency reports match this dashboard or the selected filters."
      : "No emergency reports submitted yet.";
    reportList.append(emptyState);
    return;
  }

  visibleReports.slice().reverse().forEach((report) => reportList.append(createReportCard(report)));
}

function submitEmergencyReport(event) {
  event.preventDefault();
  if (reportSubmissionInProgress || !isAllowed("submit") || !validateReportForm()) return;

  reportSubmissionInProgress = true;
  const submitButton = $("#emergency-form button[type='submit']");
  submitButton.disabled = true;

  const session = getSession();
  const report = {
    id: generateReportId(),
    emergencyType: $("#emergency-type").value,
    description: $("#description").value.trim(),
    location: $("#location").value,
    severity: $("input[name='severity']:checked").value,
    timestamp: new Date().toISOString(),
    reportStatus: "Pending",
    helperStatus: "Not yet",
    submittedBy: session.email,
  };

  if (saveReports([...reports, report])) {
    $("#emergency-form").reset();
    $("#character-count").textContent = "0 / 300";
    showMessage("#app-status", `Emergency report submitted. Report ID: ${report.id}`);
    renderDashboard();
  }

  reportSubmissionInProgress = false;
  submitButton.disabled = false;
}

async function signOutUser() {
  try {
    await window.Auth.logout();
    document.querySelectorAll("input[name='login-role']").forEach((input) => {
      input.checked = false;
    });
    location.replace("#login");
  } catch {
    showMessage("#app-status", "Sign-out failed. Check your connection and try again.", "error");
  }
}

async function startApp() {
  if (appStarted) return;
  appStarted = true;

  $("#login-form").addEventListener("submit", (event) => {
    event.preventDefault();
    handleDashboardLogin();
  });
  $("#google-signin-button").addEventListener("click", beginGoogleSignIn);
  $("#change-google-account").addEventListener("click", signOutUser);
  $("#logout-button").addEventListener("click", signOutUser);
  $("#description").addEventListener("input", () => {
    $("#character-count").textContent = `${$("#description").value.length} / 300`;
  });
  $("#emergency-form").addEventListener("submit", submitEmergencyReport);

  window.addEventListener("hashchange", route);
  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY) {
      reports = loadReports();
      if (getSession()) renderDashboard();
    }
  });
  window.addEventListener("google-auth-progress", (event) => {
    showMessage("#login-status", event.detail || "Signing in with Google…");
  });
  window.addEventListener("google-auth-state", (event) => {
    syncLoginView(event.detail?.user || null, event.detail?.error || "");
    route();
  });

  await window.Auth.whenReady();
  syncLoginView(window.Auth.getUser());
  route();
}

if (window.Auth) {
  startApp();
} else {
  window.addEventListener("auth-module-ready", startApp, { once: true });
}

