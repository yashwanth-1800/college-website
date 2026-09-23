const localQaRole = window.location.hostname === "127.0.0.1"
  ? new URLSearchParams(window.location.search).get("qa-role")
  : null;

async function bootstrapApplication() {
  if (localQaRole) await import("./qa-auth.js");
  else await import("./auth.js");

  await import("./incident-core.js");
  await import("./script.js");
}

bootstrapApplication().catch(() => {
  const status = document.querySelector("#login-status");
  if (status) {
    status.textContent = "The application could not be initialized. Refresh the page and try again.";
    status.className = "status-message error";
  }
});
