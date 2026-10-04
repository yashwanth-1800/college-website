import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

function credential() {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) return applicationDefault();
  const account = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  if (account.private_key) account.private_key = account.private_key.replace(/\\n/g, "\n");
  return cert(account);
}

const adminApp = getApps()[0] || initializeApp({
  credential: credential(),
  projectId: process.env.FIREBASE_PROJECT_ID || "emergency-app-f2850",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "emergency-app-f2850.firebasestorage.app",
});

export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp);
export const adminMessaging = getMessaging(adminApp);

export async function requireCampusUser(request, allowedRoles = []) {
  const authorization = request.headers.authorization || "";
  if (!authorization.startsWith("Bearer ")) throw Object.assign(new Error("Authentication required."), { status: 401 });
  const decoded = await adminAuth.verifyIdToken(authorization.slice(7), true);
  const profileSnapshot = await adminDb.collection("users").doc(decoded.uid).get();
  if (!profileSnapshot.exists) throw Object.assign(new Error("Campus access profile not found."), { status: 403 });
  const profile = profileSnapshot.data();
  if (profile.status !== "active") throw Object.assign(new Error("This campus account is not active."), { status: 403 });
  if (allowedRoles.length && !allowedRoles.includes(profile.role)) throw Object.assign(new Error("Your role cannot perform this action."), { status: 403 });
  return { uid: decoded.uid, email: decoded.email || "", profile };
}

export function sendApiError(response, error) {
  const status = Number(error?.status) || (error?.code?.startsWith?.("auth/") ? 401 : 500);
  response.status(status).json({ error: status >= 500 ? "The secure service is temporarily unavailable." : error.message });
}

