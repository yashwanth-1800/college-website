"use strict";

const STORAGE_KEY = "campusEmergencyReports";
const TYPES = ["Medical", "Fire", "Security", "Accident", "Other"];
const LOCATIONS = ["Main Gate", "Administration Building", "Library", "Science Block", "Engineering Block", "Student Hostel", "Cafeteria", "Sports Ground", "Parking Area", "Other"];
const ROLES = ["Student", "Volunteer", "Doctor"];
const GUIDANCE = { Low: "Check and assist the student on-site.", Medium: "Escort the student to the medical block.", High: "Coordinate directly with doctors or bring medical help immediately." };

const form = document.querySelector("#emergency-form");
const typeField = document.querySelector("#emergency-type");
const descriptionField = document.querySelector("#description");
const locationField = document.querySelector("#location");
const submitButton = document.querySelector("#submit-button");
const studentFormSection = document.querySelector("#student-form-section");
const currentRoleElement = document.querySelector("#current-role");
const statusMessage = document.querySelector("#app-status");
const reportsList = document.querySelector("#reports-list");
const reportCount = document.querySelector("#report-count");
const summaryCards = document.querySelector("#summary-cards");
const filtersElement = document.querySelector("#filters");
const workflowNote = document.querySelector("#workflow-note");
const dashboardHeading = document.querySelector("#dashboard-heading");
const dashboardEyebrow = document.querySelector("#dashboard-eyebrow");
const characterCount = document.querySelector("#character-count");
const errors = { type: document.querySelector("#type-error"), description: document.querySelector("#description-error"), location: document.querySelector("#location-error"), severity: document.querySelector("#severity-error") };

let activeRole = "Student";
let reports = loadReports();
let submitting = false;
let filters = { severity: "All", reportStatus: "All", helperStatus: "All" };

function showStatus(message, kind = "success") { statusMessage.textContent = message; statusMessage.className = `status-message ${kind}`; }
function can(action) { return ({ submit: activeRole === "Student", helperUpdate: activeRole === "Volunteer", resolve: activeRole === "Doctor" })[action] === true; }

function normaliseReport(value) {
  if (!value || typeof value !== "object") return null;
  const report = {
    id: value.id, emergencyType: value.emergencyType || value.type, description: value.description,
    location: value.location, severity: value.severity || "Low", timestamp: value.timestamp,
    reportStatus: value.reportStatus || value.status || "Pending", helperStatus: value.helperStatus || "Not yet",
    submittedBy: value.submittedBy || "Student", resolvedBy: value.resolvedBy, resolvedAt: value.resolvedAt
  };
  return typeof report.id === "string" && TYPES.includes(report.emergencyType) && LOCATIONS.includes(report.location) &&
    typeof report.description === "string" && ["Low", "Medium", "High"].includes(report.severity) &&
    typeof report.timestamp === "string" && ["Pending", "Resolved"].includes(report.reportStatus) &&
    ["Not yet", "On it", "Done"].includes(report.helperStatus) ? report : null;
}

function loadReports() {
  try { const raw = localStorage.getItem(STORAGE_KEY); if (!raw) return []; const data = JSON.parse(raw); return Array.isArray(data) ? data.map(normaliseReport).filter(Boolean) : []; }
  catch { setTimeout(() => showStatus("Saved reports could not be loaded. Starting with an empty dashboard.", "error"), 0); return []; }
}
function saveReports(nextReports) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(nextReports)); reports = nextReports; return true; }
  catch { showStatus("This browser cannot save updates locally. Please enable local storage and try again.", "error"); return false; }
}

function setError(name, message) {
  errors[name].textContent = message;
  if (name === "severity") return;
  const field = name === "type" ? typeField : name === "location" ? locationField : descriptionField;
  field.setAttribute("aria-invalid", message ? "true" : "false");
}
function selectedSeverity() { return document.querySelector('input[name="severity"]:checked')?.value || ""; }
function validateForm() {
  ["type", "description", "location", "severity"].forEach((key) => setError(key, ""));
  const description = descriptionField.value.trim(); let valid = true;
  if (!TYPES.includes(typeField.value)) { setError("type", "Select an emergency type."); valid = false; }
  if (!description) { setError("description", "Enter a description; spaces alone are not enough."); valid = false; }
  else if (description.length < 5 || description.length > 300) { setError("description", "Description must be between 5 and 300 characters."); valid = false; }
  if (!LOCATIONS.includes(locationField.value)) { setError("location", "Select a campus location."); valid = false; }
  if (!["Low", "Medium", "High"].includes(selectedSeverity())) { setError("severity", "Select one severity level."); valid = false; }
  return valid;
}
function updateCounter() { characterCount.textContent = `${descriptionField.value.length} / 300`; }
function generateId() {
  const date = new Date(); const datePart = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let id;
  do { let code = ""; const bytes = new Uint8Array(6); window.crypto?.getRandomValues?.(bytes); for (let i = 0; i < 6; i += 1) code += alphabet[(bytes[i] || Math.floor(Math.random() * 256)) % alphabet.length]; id = `ER-${datePart}-${code}`; } while (reports.some((report) => report.id === id));
  return id;
}
function formatTime(timestamp) { const date = new Date(timestamp); return Number.isNaN(date.getTime()) ? "Timestamp unavailable" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date); }

function createBadge(text, group) { const badge = document.createElement("span"); badge.className = `badge ${group}-${text.toLowerCase().replaceAll(" ", "-")}`; badge.textContent = text; return badge; }
function detail(label, value) { const row = document.createElement("div"); row.className = "detail-row"; const term = document.createElement("dt"); term.textContent = label; const data = document.createElement("dd"); data.textContent = value; row.append(term, data); return row; }
function createSelect(label, current, options, callback) {
  const wrapper = document.createElement("label"); wrapper.className = "inline-control"; const text = document.createElement("span"); text.textContent = label;
  const select = document.createElement("select"); select.setAttribute("aria-label", label); options.forEach((option) => { const item = document.createElement("option"); item.value = option; item.textContent = option; item.selected = option === current; select.append(item); });
  select.addEventListener("change", () => callback(select.value)); wrapper.append(text, select); return wrapper;
}

function renderSummary(visibleReports) {
  const values = [ ["Visible reports", visibleReports.length], ["Pending", visibleReports.filter((r) => r.reportStatus === "Pending").length], ["High severity", visibleReports.filter((r) => r.severity === "High").length], ["Resolved", visibleReports.filter((r) => r.reportStatus === "Resolved").length] ];
  if (activeRole === "Volunteer") values.push(["Tasks on it", visibleReports.filter((r) => r.helperStatus === "On it").length]);
  summaryCards.replaceChildren(); values.forEach(([label, value]) => { const card = document.createElement("div"); card.className = "summary-card"; const number = document.createElement("strong"); number.textContent = String(value); const caption = document.createElement("span"); caption.textContent = label; card.append(number, caption); summaryCards.append(card); });
}
function renderFilters() {
  filtersElement.replaceChildren(); if (activeRole === "Student") return;
  const fields = [["Severity", "severity", ["All", "Low", "Medium", "High"]], ["Report status", "reportStatus", ["All", "Pending", "Resolved"]]];
  if (activeRole === "Volunteer") fields.push(["Helper task", "helperStatus", ["All", "Not yet", "On it", "Done"]]);
  fields.forEach(([label, name, options]) => filtersElement.append(createSelect(label, filters[name], options, (value) => { filters[name] = value; renderDashboard(); })));
}
function matchesFilters(report) { return Object.entries(filters).every(([key, value]) => value === "All" || report[key] === value); }
function roleReports() { return reports.filter((report) => activeRole === "Student" ? report.submittedBy === "Student" : activeRole === "Doctor" ? report.emergencyType === "Medical" : true).filter(matchesFilters); }

function updateHelperStatus(id, status) {
  if (!can("helperUpdate")) { showStatus("Only volunteers can update helper task status.", "error"); return; }
  const report = reports.find((item) => item.id === id); if (!report) { showStatus("That report is no longer available.", "error"); return; }
  if (!["Not yet", "On it", "Done"].includes(status)) return;
  if (saveReports(reports.map((item) => item.id === id ? { ...item, helperStatus: status } : item))) { renderDashboard(); showStatus(`Volunteer task for ${id} updated to ${status}.`); }
}
function resolveReport(id) {
  if (!can("resolve")) { showStatus("Only doctors can resolve medical reports.", "error"); return; }
  const report = reports.find((item) => item.id === id);
  if (!report) { showStatus("That report is no longer available.", "error"); return; }
  if (report.emergencyType !== "Medical") { showStatus("Doctors can review non-medical reports only; medical cases are the only cases they can close.", "error"); return; }
  if (report.reportStatus !== "Pending") { showStatus("This report has already been resolved.", "error"); return; }
  if (!confirm(`Mark medical report ${id} as resolved?`)) return;
  const next = reports.map((item) => item.id === id ? { ...item, reportStatus: "Resolved", resolvedBy: "Doctor", resolvedAt: new Date().toISOString() } : item);
  if (saveReports(next)) { renderDashboard(); showStatus(`Medical report ${id} was marked as resolved by Doctor.`); }
}
function createReportCard(report) {
  const card = document.createElement("article"); card.className = `report-card ${report.severity === "High" ? "high-priority" : ""}`;
  const top = document.createElement("div"); top.className = "card-topline"; const heading = document.createElement("h3"); heading.className = "report-id"; heading.textContent = report.id; const badges = document.createElement("div"); badges.className = "badges"; badges.append(createBadge(`${report.severity} severity`, "severity"), createBadge(report.reportStatus, "report"), createBadge(report.helperStatus, "helper")); top.append(heading, badges);
  const details = document.createElement("dl"); details.className = "report-details"; details.append(detail("Emergency type", report.emergencyType), detail("Location", report.location), detail("Description", report.description), detail("Submitted", formatTime(report.timestamp)), detail("Volunteer guidance", GUIDANCE[report.severity]));
  if (report.reportStatus === "Resolved") details.append(detail("Resolved", `${report.resolvedBy || "Doctor"} · ${formatTime(report.resolvedAt)}`));
  card.append(top, details);
  if (activeRole === "Volunteer") card.append(createSelect("Update volunteer task", report.helperStatus, ["Not yet", "On it", "Done"], (value) => updateHelperStatus(report.id, value)));
  if (activeRole === "Doctor" && report.reportStatus === "Pending" && report.emergencyType === "Medical") { const button = document.createElement("button"); button.className = "resolve-button"; button.type = "button"; button.textContent = "Mark as Resolved"; button.addEventListener("click", () => resolveReport(report.id)); card.append(button); }
  return card;
}
function renderDashboard() {
  const roleTitles = { Student: ["Student dashboard", "My submitted reports"], Volunteer: ["Helper / Volunteer dashboard", "Incoming emergency reports"], Doctor: ["Doctor dashboard", "Medical emergency cases"] };
  dashboardEyebrow.textContent = roleTitles[activeRole][0]; dashboardHeading.textContent = roleTitles[activeRole][1];
  workflowNote.textContent = activeRole === "Volunteer" ? "Task statuses: Not yet = no volunteer has started; On it = assistance or transport is in progress; Done = volunteer assistance is complete. Volunteers cannot resolve an overall report." : activeRole === "Doctor" ? "Medical-case policy: doctors may resolve medical reports only. Non-medical reports are handled by the appropriate campus service and are not shown in this medical queue." : "Your reports start as Pending. Volunteers coordinate the first response; doctors close medical cases after review.";
  const visible = roleReports(); renderSummary(visible); renderFilters(); reportsList.replaceChildren(); reportCount.textContent = `${visible.length} ${visible.length === 1 ? "report" : "reports"}`;
  if (!visible.length) { const empty = document.createElement("p"); empty.className = "empty-state"; empty.textContent = activeRole === "Doctor" ? "No medical reports match the selected filter." : "No emergency reports match the selected filter."; reportsList.append(empty); return; }
  visible.slice().reverse().forEach((report) => reportsList.append(createReportCard(report)));
}
function setRole(role) {
  if (!ROLES.includes(role)) return; activeRole = role; filters = { severity: "All", reportStatus: "All", helperStatus: "All" }; currentRoleElement.textContent = role === "Volunteer" ? "Helper / Volunteer" : role;
  studentFormSection.hidden = role !== "Student"; document.querySelectorAll(".role-button").forEach((button) => { const active = button.dataset.role === role; button.classList.toggle("active", active); button.setAttribute("aria-selected", String(active)); }); renderDashboard(); showStatus(`${currentRoleElement.textContent} dashboard selected.`);
}

form.addEventListener("submit", (event) => {
  event.preventDefault(); if (!can("submit")) { showStatus("Only students can submit emergency reports.", "error"); return; } if (submitting) return;
  if (!validateForm()) { showStatus("Please correct the highlighted fields before submitting.", "error"); return; }
  submitting = true; submitButton.disabled = true; submitButton.textContent = "Saving report…";
  const report = { id: generateId(), emergencyType: typeField.value, description: descriptionField.value.trim(), location: locationField.value, severity: selectedSeverity(), timestamp: new Date().toISOString(), reportStatus: "Pending", helperStatus: "Not yet", submittedBy: "Student" };
  if (saveReports([...reports, report])) { form.reset(); updateCounter(); renderDashboard(); showStatus(`Emergency report submitted successfully. Your report ID is ${report.id}.`); }
  submitting = false; submitButton.disabled = false; submitButton.textContent = "Report Emergency";
});
descriptionField.addEventListener("input", () => { updateCounter(); setError("description", ""); }); typeField.addEventListener("change", () => setError("type", "")); locationField.addEventListener("change", () => setError("location", "")); document.querySelectorAll('input[name="severity"]').forEach((input) => input.addEventListener("change", () => setError("severity", "")));
document.querySelectorAll(".role-button").forEach((button) => button.addEventListener("click", () => setRole(button.dataset.role)));
updateCounter(); renderDashboard();

