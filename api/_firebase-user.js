const FIREBASE_API_KEY = process.env.FIREBASE_WEB_API_KEY || "AIzaSyD7NMp66LLaZYi_5uqbrbU-SFCJRCRyTmY";
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "emergency-app-f2850";

export async function requireFirebaseUser(request, allowedRoles = []) {
  const authorization = request.headers.authorization || "";
  if (!authorization.startsWith("Bearer ")) throw Object.assign(new Error("Authentication required."), { status: 401 });
  const idToken = authorization.slice(7);
  const lookupResponse = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!lookupResponse.ok) throw Object.assign(new Error("Your sign-in session is no longer valid."), { status: 401 });
  const account = (await lookupResponse.json()).users?.[0];
  if (!account?.localId) throw Object.assign(new Error("Authenticated user not found."), { status: 401 });
  const profileResponse = await fetch(`https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${account.localId}`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!profileResponse.ok) throw Object.assign(new Error("Campus access profile not found."), { status: 403 });
  const fields = (await profileResponse.json()).fields || {};
  const profile = {
    role: fields.role?.stringValue,
    status: fields.status?.stringValue,
    displayName: fields.displayName?.stringValue,
  };
  if (profile.status !== "active" || (allowedRoles.length && !allowedRoles.includes(profile.role))) {
    throw Object.assign(new Error("Your assigned role cannot perform this action."), { status: 403 });
  }
  return { uid: account.localId, email: account.email || "", profile };
}

