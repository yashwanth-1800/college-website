"use strict";

(function exposeIncidentCore(globalScope) {
  const PRIORITIES = ["Critical", "High", "Medium", "Low"];
  const INCIDENT_STATUSES = ["Reported", "Acknowledged", "Responding", "Resolved"];
  const EMERGENCY_TYPES = ["Medical", "Fire", "Security", "Accident", "Other"];
  const HELPER_STATUSES = ["Not yet", "On it", "Done"];

  function cleanText(value, maximumLength = 500) {
    return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maximumLength) : "";
  }

  function validIso(value) {
    if (typeof value !== "string" || Number.isNaN(Date.parse(value))) return "";
    return new Date(value).toISOString();
  }

  function normalizeLocation(value) {
    if (typeof value === "string") {
      return {
        campus: "SRM Campus",
        building: cleanText(value, 80) || "Other",
        floor: "Not specified",
        area: "",
      };
    }

    const source = value && typeof value === "object" ? value : {};
    return {
      campus: cleanText(source.campus, 80) || "SRM Campus",
      building: cleanText(source.building || source.block, 80) || "Other",
      floor: cleanText(source.floor, 40) || "Not specified",
      area: cleanText(source.area || source.room, 80),
    };
  }

  function formatLocation(value) {
    const location = normalizeLocation(value);
    return [location.campus, location.building, location.floor, location.area]
      .filter((part) => part && part !== "Not specified")
      .join(" — ");
  }

  function classifyPriority({ emergencyType, description, location }) {
    const category = cleanText(emergencyType, 40);
    const searchable = `${category} ${cleanText(description)} ${formatLocation(location)}`.toLowerCase();

    const criticalTerms = [
      "not breathing", "unconscious", "severe bleeding", "life threatening", "life-threatening",
      "heart attack", "cardiac arrest", "explosion", "active shooter", "weapon", "gun",
      "gas leak", "building collapse", "trapped", "large fire", "on fire",
    ];
    const highTerms = [
      "electrical", "electric shock", "exposed wire", "sparking", "short circuit", "chemical spill",
      "hazardous", "major accident", "serious injury", "smoke", "structural damage", "violent",
    ];
    const mediumTerms = [
      "minor injury", "suspicious", "fainted", "dizzy", "fall", "collision", "theft", "fight",
      "broken", "unsafe", "injured",
    ];
    const lowTerms = ["non urgent", "non-urgent", "no immediate danger", "minor issue", "information only"];

    if (category === "Fire" || criticalTerms.some((term) => searchable.includes(term))) return "Critical";
    if (highTerms.some((term) => searchable.includes(term))) return "High";
    if (mediumTerms.some((term) => searchable.includes(term))) return "Medium";
    if (["Medical", "Security", "Accident"].includes(category)) return "Medium";
    if (lowTerms.some((term) => searchable.includes(term)) || category === "Other") return "Low";
    return "Low";
  }

  function summarizeDescription(value) {
    const description = cleanText(value, 300);
    if (!description) return "";
    if (description.length <= 120) return description;

    const sentenceMatch = description.match(/^.{35,180}?[.!?](?:\s|$)/);
    if (sentenceMatch) return sentenceMatch[0].trim();

    const shortened = description.slice(0, 170);
    const lastSpace = shortened.lastIndexOf(" ");
    return `${shortened.slice(0, lastSpace > 80 ? lastSpace : 170).trim()}…`;
  }

  function priorityToSeverity(priority) {
    if (priority === "Critical" || priority === "High") return "High";
    if (priority === "Medium") return "Medium";
    return "Low";
  }

  function normalizeStatus(value) {
    if (INCIDENT_STATUSES.includes(value)) return value;
    return value === "Resolved" ? "Resolved" : "Reported";
  }

  function migrateReport(value) {
    if (!value || typeof value !== "object") return null;

    const id = cleanText(value.id || value.reportId, 60);
    const emergencyType = EMERGENCY_TYPES.includes(value.emergencyType || value.category)
      ? value.emergencyType || value.category
      : "";
    const description = cleanText(value.description, 300);
    const createdAt = validIso(value.createdAt || value.timestamp || value.reportedAt);
    if (!id || !emergencyType || description.length < 5 || !createdAt) return null;

    const location = normalizeLocation(value.location);
    const classifiedPriority = classifyPriority({ emergencyType, description, location });
    const originalPriority = PRIORITIES.includes(value.originalPriority)
      ? value.originalPriority
      : classifiedPriority;
    const priority = PRIORITIES.includes(value.priority) ? value.priority : originalPriority;
    const status = normalizeStatus(value.status || value.reportStatus);
    const resolvedAt = validIso(value.resolvedAt);
    const updatedAt = validIso(value.updatedAt) || resolvedAt || createdAt;
    const helperStatus = HELPER_STATUSES.includes(value.helperStatus) ? value.helperStatus : "Not yet";

    return {
      id,
      reportId: id,
      emergencyType,
      category: emergencyType,
      description,
      summary: cleanText(value.summary, 220) || summarizeDescription(description),
      priority,
      originalPriority,
      priorityOverridden: Boolean(value.priorityOverridden) || priority !== originalPriority,
      priorityOverrideAt: validIso(value.priorityOverrideAt),
      location,
      status,
      createdAt,
      reportedAt: validIso(value.reportedAt) || createdAt,
      acknowledgedAt: validIso(value.acknowledgedAt),
      respondingAt: validIso(value.respondingAt),
      resolvedAt,
      updatedAt,
      helperStatus,
      helperUpdatedAt: validIso(value.helperUpdatedAt),
      submittedBy: cleanText(value.submittedBy, 160) || "Student",
      resolvedBy: cleanText(value.resolvedBy, 80),
      timestamp: createdAt,
      reportStatus: status === "Resolved" ? "Resolved" : "Pending",
      severity: priorityToSeverity(priority),
    };
  }

  function nextStatus(status) {
    const index = INCIDENT_STATUSES.indexOf(status);
    return index >= 0 && index < INCIDENT_STATUSES.length - 1 ? INCIDENT_STATUSES[index + 1] : null;
  }

  function locationKey(report) {
    const location = normalizeLocation(report.location);
    return [location.building, location.area].filter(Boolean).join(" — ");
  }

  function calculateAnalytics(reports, now = new Date()) {
    const safeReports = Array.isArray(reports) ? reports : [];
    const categoryCounts = new Map();
    const locationCounts = new Map();
    const recentLocationCounts = new Map();
    const resolutionDurations = [];
    const recentBoundary = new Date(now);
    recentBoundary.setDate(recentBoundary.getDate() - 30);

    safeReports.forEach((report) => {
      categoryCounts.set(report.emergencyType, (categoryCounts.get(report.emergencyType) || 0) + 1);
      const key = locationKey(report) || "Unspecified location";
      locationCounts.set(key, (locationCounts.get(key) || 0) + 1);
      if (new Date(report.createdAt) >= recentBoundary) {
        recentLocationCounts.set(key, (recentLocationCounts.get(key) || 0) + 1);
      }
      if (report.status === "Resolved" && report.resolvedAt) {
        const duration = new Date(report.resolvedAt) - new Date(report.createdAt);
        if (Number.isFinite(duration) && duration >= 0) resolutionDurations.push(duration);
      }
    });

    const daily = [];
    for (let offset = 6; offset >= 0; offset -= 1) {
      const day = new Date(now);
      day.setHours(0, 0, 0, 0);
      day.setDate(day.getDate() - offset);
      const nextDay = new Date(day);
      nextDay.setDate(nextDay.getDate() + 1);
      daily.push({
        label: new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(day),
        count: safeReports.filter((report) => {
          const created = new Date(report.createdAt);
          return created >= day && created < nextDay;
        }).length,
      });
    }

    const sortCounts = (counts) => [...counts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
    const hotspot = sortCounts(recentLocationCounts).find((item) => item.count >= 2) || null;

    return {
      total: safeReports.length,
      active: safeReports.filter((report) => report.status !== "Resolved").length,
      critical: safeReports.filter((report) => report.priority === "Critical").length,
      resolved: safeReports.filter((report) => report.status === "Resolved").length,
      averageResolutionMs: resolutionDurations.length
        ? resolutionDurations.reduce((sum, value) => sum + value, 0) / resolutionDurations.length
        : null,
      categories: sortCounts(categoryCounts),
      locations: sortCounts(locationCounts),
      daily,
      hotspot,
    };
  }

  const core = {
    EMERGENCY_TYPES,
    HELPER_STATUSES,
    INCIDENT_STATUSES,
    PRIORITIES,
    calculateAnalytics,
    classifyPriority,
    cleanText,
    formatLocation,
    migrateReport,
    nextStatus,
    normalizeLocation,
    priorityToSeverity,
    summarizeDescription,
  };

  globalScope.CampusIncidentCore = core;
  if (typeof module !== "undefined" && module.exports) module.exports = core;
})(typeof window !== "undefined" ? window : globalThis);
