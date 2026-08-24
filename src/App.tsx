import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactElement,
} from "react";
import {
  HashRouter,
  Navigate,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "./lib/firebase";
import { AuthProvider, useAuth } from "./AuthContext";
import type {
  EmergencyReport,
  EmergencyType,
  HelperStatus,
  ReportStatus,
  Role,
  Severity,
} from "./types";
import "./styles.css";

const roleChoices: Array<{ role: Role; title: string; text: string; icon: string }> = [
  {
    role: "student",
    title: "Student",
    text: "Submit emergencies and follow the response to your reports.",
    icon: "🎓",
  },
  {
    role: "volunteer",
    title: "Helper / Volunteer",
    text: "View incoming reports and update first-response progress.",
    icon: "🤝",
  },
  {
    role: "doctor",
    title: "Doctor",
    text: "Review medical cases and resolve them after treatment.",
    icon: "🩺",
  },
];

const emergencyTypes: EmergencyType[] = ["Medical", "Fire", "Security", "Accident", "Other"];
const campusLocations = [
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
const severities: Severity[] = ["Low", "Medium", "High"];
const helperStatuses: HelperStatus[] = ["Not yet", "On it", "Done"];
const guidance: Record<Severity, string> = {
  Low: "Check and assist the student on-site.",
  Medium: "Escort the student to the medical block.",
  High: "Coordinate directly with doctors or bring medical help immediately.",
};
const severityHelp: Record<Severity, string> = {
  Low: "Handled or checked directly by volunteers on-site.",
  Medium: "Volunteers escort the student to the medical block.",
  High: "Volunteers coordinate with doctors or bring medical help immediately.",
};

const formatTime = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown time" : date.toLocaleString();
};

const makeReportId = () => {
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const random = crypto.getRandomValues(new Uint32Array(1))[0].toString(36).toUpperCase().padStart(6, "0").slice(0, 6);
  return `ER-${date}-${random}`;
};

function useReports() {
  const { user, profile } = useAuth();
  const [reports, setReports] = useState<EmergencyReport[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [reportsError, setReportsError] = useState("");

  useEffect(() => {
    if (!user || !profile?.role) {
      setReports([]);
      setReportsLoading(false);
      return;
    }

    setReportsLoading(true);
    setReportsError("");
    const reportsReference = collection(db, "reports");
    const reportsQuery =
      profile.role === "student"
        ? query(reportsReference, where("submittedBy", "==", user.uid))
        : query(reportsReference);

    return onSnapshot(
      reportsQuery,
      (snapshot) => {
        const savedReports = snapshot.docs
          .map((reportDocument) => reportDocument.data() as EmergencyReport)
          .sort((first, second) => second.timestamp.localeCompare(first.timestamp));
        setReports(savedReports);
        setReportsLoading(false);
      },
      (error) => {
        setReportsError(`Reports could not load: ${error.message}`);
        setReportsLoading(false);
      },
    );
  }, [profile?.role, user]);

  return { reports, reportsLoading, reportsError };
}

function Login() {
  const { user, profile, loading, authError, signInWithGoogle } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (loading) return <main className="centered-state">Completing secure sign-in…</main>;
  if (user) return <Navigate to={profile?.role ? "/dashboard" : "/select-role"} replace />;

  const signIn = async () => {
    setBusy(true);
    setError("");
    try {
      await signInWithGoogle();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Sign-in failed.");
      setBusy(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-intro">
        <p className="eyebrow">Campus safety service</p>
        <h1>Campus Emergency Response</h1>
        <p>Report an emergency, coordinate volunteer assistance, and close medical cases securely.</p>
      </section>
      <section className="card login-card" aria-labelledby="login-heading">
        <h2 id="login-heading">Sign in to continue</h2>
        <p>Use your Google account, then choose a demo role for this prototype.</p>
        <button className="google-button" onClick={signIn} disabled={busy}>
          {busy ? "Opening Google…" : "G  Continue with Google"}
        </button>
        {(error || authError) && <p role="alert" className="error-message">{error || authError}</p>}
      </section>
    </main>
  );
}

function SelectRole() {
  const { profile, updateRole } = useAuth();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Role | null>(profile?.role ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const moveSelection = (event: KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = roleChoices.findIndex((choice) => choice.role === selected);
    if (["ArrowRight", "ArrowDown"].includes(event.key)) {
      event.preventDefault();
      setSelected(roleChoices[(currentIndex + 1 + roleChoices.length) % roleChoices.length].role);
    }
    if (["ArrowLeft", "ArrowUp"].includes(event.key)) {
      event.preventDefault();
      setSelected(roleChoices[(currentIndex - 1 + roleChoices.length) % roleChoices.length].role);
    }
  };

  const saveRole = async () => {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      await updateRole(selected);
      navigate("/dashboard", { replace: true });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not save the selected role.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="role-page">
      <section className="card">
        <p className="eyebrow">Demo access</p>
        <h1>Choose your workspace</h1>
        <p className="muted">This switcher demonstrates the workflow; it is not production security.</p>
        <div className="role-grid" role="radiogroup" aria-label="Choose a role" onKeyDown={moveSelection}>
          {roleChoices.map((choice) => (
            <button
              key={choice.role}
              role="radio"
              aria-checked={selected === choice.role}
              className={`role-option ${selected === choice.role ? "selected" : ""}`}
              onClick={() => setSelected(choice.role)}
            >
              <span className="role-icon" aria-hidden="true">{choice.icon}</span>
              <strong>{choice.title}</strong>
              <small>{choice.text}</small>
            </button>
          ))}
        </div>
        <button className="primary-button" disabled={!selected || busy} onClick={saveRole}>
          {busy ? "Saving role…" : "Continue to dashboard"}
        </button>
        {error && <p role="alert" className="error-message">{error}</p>}
      </section>
    </main>
  );
}

function SummaryCards({ reports }: { reports: EmergencyReport[] }) {
  const values = [
    ["Total reports", reports.length],
    ["Pending", reports.filter((report) => report.reportStatus === "Pending").length],
    ["High severity", reports.filter((report) => report.severity === "High").length],
    ["Resolved", reports.filter((report) => report.reportStatus === "Resolved").length],
    ["Tasks on it", reports.filter((report) => report.helperStatus === "On it").length],
  ];

  return (
    <section className="summary-grid" aria-label="Report summary">
      {values.map(([label, value]) => (
        <article className="summary-card" key={label}>
          <strong>{value}</strong>
          <span>{label}</span>
        </article>
      ))}
    </section>
  );
}

function Badge({ children, kind }: { children: string; kind: string }) {
  return <span className={`badge badge-${kind}`}>{children}</span>;
}

function ReportCard({
  report,
  role,
  onHelperStatus,
  onResolve,
}: {
  report: EmergencyReport;
  role: Role;
  onHelperStatus?: (reportId: string, status: HelperStatus) => void;
  onResolve?: (reportId: string) => void;
}) {
  return (
    <article className={`report-card ${report.severity === "High" ? "high-priority" : ""}`}>
      <div className="report-heading">
        <div>
          <p className="report-id">{report.id}</p>
          <h3>{report.emergencyType} emergency</h3>
        </div>
        <div className="badges">
          <Badge kind={`severity-${report.severity.toLowerCase()}`}>{`${report.severity} severity`}</Badge>
          <Badge kind={`report-${report.reportStatus.toLowerCase()}`}>{report.reportStatus}</Badge>
          <Badge kind={`helper-${report.helperStatus.toLowerCase().replaceAll(" ", "-")}`}>{report.helperStatus}</Badge>
        </div>
      </div>
      {report.severity === "High" && <p className="priority-note"><strong>High priority:</strong> immediate coordination required.</p>}
      <dl className="report-details">
        <div><dt>Location</dt><dd>{report.location}</dd></div>
        <div><dt>Description</dt><dd>{report.description}</dd></div>
        <div><dt>Submitted</dt><dd>{formatTime(report.timestamp)}</dd></div>
        <div><dt>Volunteer guidance</dt><dd>{guidance[report.severity]}</dd></div>
        {report.resolvedAt && <div><dt>Resolved</dt><dd>By {report.resolvedBy} on {formatTime(report.resolvedAt)}</dd></div>}
      </dl>
      {role === "volunteer" && onHelperStatus && (
        <label className="card-control">
          Helper task status
          <select value={report.helperStatus} onChange={(event) => onHelperStatus(report.id, event.target.value as HelperStatus)}>
            {helperStatuses.map((status) => <option key={status}>{status}</option>)}
          </select>
        </label>
      )}
      {role === "doctor" && report.emergencyType === "Medical" && report.reportStatus === "Pending" && onResolve && (
        <button className="resolve-button" onClick={() => onResolve(report.id)}>Mark as Resolved</button>
      )}
    </article>
  );
}

function StudentDashboard({ reports }: { reports: EmergencyReport[] }) {
  const { user, profile } = useAuth();
  const [emergencyType, setEmergencyType] = useState<EmergencyType | "">("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [severity, setSeverity] = useState<Severity | "">("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const submitReport = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;

    const nextErrors: Record<string, string> = {};
    const trimmedDescription = description.trim();
    if (!emergencyType) nextErrors.emergencyType = "Select an emergency type.";
    if (!location) nextErrors.location = "Select a campus location.";
    if (!severity) nextErrors.severity = "Select a severity level.";
    if (!trimmedDescription) nextErrors.description = "Describe the emergency.";
    else if (trimmedDescription.length < 5) nextErrors.description = "Use at least 5 characters.";
    else if (trimmedDescription.length > 300) nextErrors.description = "Use no more than 300 characters.";
    if (!user || profile?.role !== "student") nextErrors.form = "Only a signed-in student can submit a report.";

    setErrors(nextErrors);
    setMessage("");
    if (Object.keys(nextErrors).length) return;

    setBusy(true);
    try {
      let reportId = "";
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const candidate = makeReportId();
        if (!(await getDoc(doc(db, "reports", candidate))).exists()) {
          reportId = candidate;
          break;
        }
      }
      if (!reportId) throw new Error("A unique report ID could not be generated. Please retry.");

      const report: EmergencyReport = {
        id: reportId,
        emergencyType: emergencyType as EmergencyType,
        description: trimmedDescription,
        location,
        severity: severity as Severity,
        timestamp: new Date().toISOString(),
        reportStatus: "Pending",
        helperStatus: "Not yet",
        submittedBy: user!.uid,
        submittedByName: user!.displayName ?? "Student",
        submittedByEmail: user!.email ?? "",
      };
      await setDoc(doc(db, "reports", reportId), report);
      setEmergencyType("");
      setDescription("");
      setLocation("");
      setSeverity("");
      setMessage(`Emergency reported successfully. Your report ID is ${reportId}.`);
    } catch (caughtError) {
      setErrors({ form: caughtError instanceof Error ? caughtError.message : "The report could not be saved." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section className="card form-card" aria-labelledby="report-heading">
        <div className="section-heading">
          <div><p className="eyebrow">Student action</p><h2 id="report-heading">Report an emergency</h2></div>
          <span className="required-note">All fields are required</span>
        </div>
        <form onSubmit={submitReport} noValidate>
          <div className="form-grid">
            <label>Emergency type
              <select value={emergencyType} onChange={(event) => setEmergencyType(event.target.value as EmergencyType | "")} aria-invalid={Boolean(errors.emergencyType)}>
                <option value="">Select type</option>
                {emergencyTypes.map((type) => <option key={type}>{type}</option>)}
              </select>
              {errors.emergencyType && <span className="field-error">{errors.emergencyType}</span>}
            </label>
            <label>Campus location
              <select value={location} onChange={(event) => setLocation(event.target.value)} aria-invalid={Boolean(errors.location)}>
                <option value="">Select location</option>
                {campusLocations.map((place) => <option key={place}>{place}</option>)}
              </select>
              {errors.location && <span className="field-error">{errors.location}</span>}
            </label>
          </div>
          <label>What is the emergency?
            <textarea value={description} maxLength={300} onChange={(event) => setDescription(event.target.value)} aria-invalid={Boolean(errors.description)} aria-describedby="description-counter description-error" />
            <span className="field-meta" id="description-counter">{description.length}/300 characters</span>
            {errors.description && <span className="field-error" id="description-error">{errors.description}</span>}
          </label>
          <fieldset>
            <legend>Severity level</legend>
            <div className="severity-grid">
              {severities.map((level) => (
                <label className={`severity-option severity-${level.toLowerCase()}`} key={level}>
                  <input type="radio" name="severity" value={level} checked={severity === level} onChange={() => setSeverity(level)} />
                  <span><strong>{level} Severity</strong><small>{severityHelp[level]}</small></span>
                </label>
              ))}
            </div>
            {errors.severity && <span className="field-error">{errors.severity}</span>}
          </fieldset>
          <button className="primary-button" type="submit" disabled={busy}>{busy ? "Saving report…" : "Report Emergency"}</button>
          <div className="live-message" aria-live="polite">
            {message && <p className="success-message">{message}</p>}
            {errors.form && <p className="error-message">{errors.form}</p>}
          </div>
        </form>
      </section>
      <section aria-labelledby="student-reports-heading">
        <div className="section-heading"><h2 id="student-reports-heading">My submitted reports</h2><span>{reports.length} total</span></div>
        <ReportList reports={reports} role="student" />
      </section>
    </>
  );
}

function ReportList({ reports, role, onHelperStatus, onResolve }: { reports: EmergencyReport[]; role: Role; onHelperStatus?: (id: string, status: HelperStatus) => void; onResolve?: (id: string) => void }) {
  if (!reports.length) return <p className="empty-state">No emergency reports match this view.</p>;
  return <div className="report-grid">{reports.map((report) => <ReportCard key={report.id} report={report} role={role} onHelperStatus={onHelperStatus} onResolve={onResolve} />)}</div>;
}

function VolunteerDashboard({ reports }: { reports: EmergencyReport[] }) {
  const { profile } = useAuth();
  const [severityFilter, setSeverityFilter] = useState<Severity | "All">("All");
  const [reportFilter, setReportFilter] = useState<ReportStatus | "All">("All");
  const [helperFilter, setHelperFilter] = useState<HelperStatus | "All">("All");
  const [message, setMessage] = useState("");

  const filtered = useMemo(() => reports.filter((report) =>
    (severityFilter === "All" || report.severity === severityFilter) &&
    (reportFilter === "All" || report.reportStatus === reportFilter) &&
    (helperFilter === "All" || report.helperStatus === helperFilter)), [reports, severityFilter, reportFilter, helperFilter]);

  const updateHelperStatus = async (reportId: string, status: HelperStatus) => {
    if (profile?.role !== "volunteer") {
      setMessage("Only volunteers can update helper task status.");
      return;
    }
    const report = reports.find((item) => item.id === reportId);
    if (!report) {
      setMessage("This report no longer exists.");
      return;
    }
    try {
      await updateDoc(doc(db, "reports", reportId), { helperStatus: status, helperUpdatedBy: profile.uid, helperUpdatedAt: new Date().toISOString() });
      setMessage(`${reportId} helper task updated to ${status}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The helper status could not be updated.");
    }
  };

  return (
    <section aria-labelledby="volunteer-heading">
      <div className="section-heading"><div><p className="eyebrow">First response</p><h2 id="volunteer-heading">Incoming emergency reports</h2></div><span>{filtered.length} shown</span></div>
      <p className="workflow-note"><strong>Not yet</strong>: unassigned. <strong>On it</strong>: assistance or transport is in progress. <strong>Done</strong>: volunteer assistance is complete. Volunteers cannot resolve the overall report.</p>
      <div className="filters" aria-label="Volunteer report filters">
        <Filter label="Severity" value={severityFilter} options={["All", ...severities]} onChange={(value) => setSeverityFilter(value as Severity | "All")} />
        <Filter label="Report status" value={reportFilter} options={["All", "Pending", "Resolved"]} onChange={(value) => setReportFilter(value as ReportStatus | "All")} />
        <Filter label="Helper status" value={helperFilter} options={["All", ...helperStatuses]} onChange={(value) => setHelperFilter(value as HelperStatus | "All")} />
      </div>
      <p className="live-message" aria-live="polite">{message}</p>
      <ReportList reports={filtered} role="volunteer" onHelperStatus={updateHelperStatus} />
    </section>
  );
}

function DoctorDashboard({ reports }: { reports: EmergencyReport[] }) {
  const { profile } = useAuth();
  const [statusFilter, setStatusFilter] = useState<ReportStatus | "All">("Pending");
  const [message, setMessage] = useState("");
  const medicalReports = useMemo(() => reports.filter((report) => report.emergencyType === "Medical" && (statusFilter === "All" || report.reportStatus === statusFilter)), [reports, statusFilter]);

  const resolveReport = async (reportId: string) => {
    if (profile?.role !== "doctor") {
      setMessage("Only doctors can resolve a medical report.");
      return;
    }
    const report = reports.find((item) => item.id === reportId);
    if (!report) return setMessage("This report no longer exists.");
    if (report.emergencyType !== "Medical") return setMessage("Doctors can resolve medical reports only.");
    if (report.reportStatus === "Resolved") return setMessage("This report is already resolved.");
    if (!window.confirm(`Mark medical report ${reportId} as resolved?`)) return;
    try {
      await updateDoc(doc(db, "reports", reportId), { reportStatus: "Resolved", resolvedBy: "Doctor", resolvedAt: new Date().toISOString() });
      setMessage(`${reportId} was marked as resolved.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The report could not be resolved.");
    }
  };

  return (
    <section aria-labelledby="doctor-heading">
      <div className="section-heading"><div><p className="eyebrow">Clinical review</p><h2 id="doctor-heading">Medical emergency cases</h2></div><span>{medicalReports.length} shown</span></div>
      <p className="workflow-note">Doctors can review incoming reports but can resolve <strong>medical cases only</strong>. Volunteer progress remains visible on every case.</p>
      <div className="filters"><Filter label="Case status" value={statusFilter} options={["All", "Pending", "Resolved"]} onChange={(value) => setStatusFilter(value as ReportStatus | "All")} /></div>
      <p className="live-message" aria-live="polite">{message}</p>
      <ReportList reports={medicalReports} role="doctor" onResolve={resolveReport} />
    </section>
  );
}

function Filter({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label>{label}<select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option}>{option}</option>)}</select></label>;
}

function Dashboard() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { reports, reportsLoading, reportsError } = useReports();
  const firstName = profile?.displayName?.split(" ")[0] || "there";

  if (!profile?.role) return <Navigate to="/select-role" replace />;

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand-block"><p className="eyebrow">Campus safety service</p><h1>Emergency Response</h1><p>Signed in as {user?.email}</p></div>
        <div className="header-actions"><span className="role-badge">Current role: {roleChoices.find((choice) => choice.role === profile.role)?.title}</span><button className="secondary-button" onClick={() => navigate("/select-role")}>Change role</button><button className="secondary-button" onClick={() => signOut()}>Sign out</button></div>
      </header>
      <p className="welcome-line">Welcome, {firstName}. Your dashboard is synchronized with Firebase.</p>
      <SummaryCards reports={reports} />
      {reportsError && <p role="alert" className="error-message">{reportsError}</p>}
      {reportsLoading ? <p className="centered-state">Loading emergency reports…</p> : profile.role === "student" ? <StudentDashboard reports={reports} /> : profile.role === "volunteer" ? <VolunteerDashboard reports={reports} /> : <DoctorDashboard reports={reports} />}
      <footer className="security-note">Prototype notice: role switching is for demonstration only. A production deployment requires backend authentication, server-side authorization, secure database controls, audit logs, and appropriate privacy safeguards.</footer>
    </main>
  );
}

function Guard({ children, requireRole = false }: { children: ReactElement; requireRole?: boolean }) {
  const { user, profile, loading } = useAuth();
  if (loading) return <main className="centered-state">Loading your secure workspace…</main>;
  if (!user) return <Navigate to="/login" replace />;
  if (requireRole && !profile?.role) return <Navigate to="/select-role" replace />;
  return children;
}

function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/select-role" element={<Guard><SelectRole /></Guard>} />
          <Route path="/dashboard" element={<Guard requireRole><Dashboard /></Guard>} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}

export default App;

