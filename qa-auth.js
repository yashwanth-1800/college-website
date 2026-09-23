// Browser QA only: this module is selected exclusively on the 127.0.0.1 loopback host.
// Production hosts always load Firebase authentication from auth.js.
const allowedRoles = ["Student", "Volunteer", "Doctor", "Administrator"];
const requestedRole = new URLSearchParams(window.location.search).get("qa-role");
const role = allowedRoles.includes(requestedRole) ? requestedRole : "Student";
let session = {
  uid: `qa-${role.toLowerCase()}`,
  email: "qa.student@example.test",
  name: "Local QA User",
  role,
  timestamp: new Date().toISOString(),
};

window.Auth = {
  chooseRole(nextRole) {
    if (!allowedRoles.includes(nextRole)) return null;
    session = { ...session, role: nextRole, timestamp: new Date().toISOString() };
    return session;
  },
  getSession: () => session,
  getUser: () => session ? { uid: session.uid, email: session.email, name: session.name } : null,
  isReady: () => true,
  async logout() {
    session = null;
    window.dispatchEvent(new CustomEvent("google-auth-state", { detail: { ready: true, user: null, error: "" } }));
  },
  roles: [...allowedRoles],
  signInWithGoogle: async () => true,
  whenReady: async () => {},
};

window.dispatchEvent(new Event("auth-module-ready"));
queueMicrotask(() => {
  window.dispatchEvent(new CustomEvent("google-auth-state", {
    detail: { ready: true, user: window.Auth.getUser(), error: "" },
  }));
});
